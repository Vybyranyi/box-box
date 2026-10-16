/**
 * Generates src/data/*.json from real data:
 *   - Jolpica (Ergast successor): calendar, lineups, standings, qualifying, results, pit stops
 *   - OpenF1: team colours, driver media references, headshots
 *   - bacinger/f1-circuits (MIT): circuit outlines
 * plus the hand-curated values in scripts/curated.
 *
 * Usage: npm run data            (uses the on-disk cache in scripts/.cache)
 *        npm run data -- --refresh
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  CalendarRound,
  Car,
  Driver,
  Team,
  Track,
} from "../src/data/types";
import { curatedDrivers } from "./curated/drivers";
import { curatedTeams } from "./curated/teams";
import {
  curatedTracks,
  downforceLikeStreetTracks,
  powerLikeStreetTracks,
  anticlockwiseTracks,
  figureOfEightTracks,
  reversedGeometry,
} from "./curated/tracks";
import {
  type LonLat,
  signedArea,
  haversine,
  openRing,
  projectToMeters,
  resampleClosed,
  roundPoints,
  scaleToLength,
  smoothClosed,
} from "./lib/geometry";
import { fetchCached } from "./lib/http";
import {
  type JQualifying,
  type JRace,
  type JResult,
  jolpica,
  parseLapTime,
} from "./lib/jolpica";

const SEASON = 2026;
const PREVIOUS = 2025;
const OUT_DIR = join(import.meta.dirname, "..", "src", "data");
const PATH_POINTS = 600;

const median = (xs: number[]) => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x));
const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
const warn = (msg: string) => console.warn(`  ! ${msg}`);

type RoundData = {
  season: number;
  race: JRace;
  results: JResult[];
  qualifying: JQualifying[];
  pitDurations: number[];
};

async function loadRound(season: number, race: JRace): Promise<RoundData> {
  const r = Number(race.round);
  const [results, qualifying, pitStops] = [
    await jolpica.results(season, r),
    await jolpica.qualifying(season, r),
    await jolpica.pitStops(season, r),
  ];
  const pitDurations = pitStops
    .map((p) => Number(p.duration))
    .filter((d) => d >= 14 && d <= 45);
  return { season, race, results, qualifying, pitDurations };
}

function bestQualiTime(q: JQualifying): number | null {
  const times = [q.Q1, q.Q2, q.Q3]
    .map(parseLapTime)
    .filter((t): t is number => t !== null);
  return times.length ? Math.min(...times) : null;
}

/** Latest session both drivers set a time in, and the gap of `a` to `b` in %. */
function teammateGapPct(a: JQualifying, b: JQualifying): number | null {
  for (const session of ["Q3", "Q2", "Q1"] as const) {
    const ta = parseLapTime(a[session]);
    const tb = parseLapTime(b[session]);
    if (ta && tb) return ((ta - tb) / Math.min(ta, tb)) * 100;
  }
  return null;
}

function trackGroup(circuitId: string): "power" | "downforce" | "other" {
  const type = curatedTracks[circuitId]?.type;
  if (type === "power" || powerLikeStreetTracks.has(circuitId)) return "power";
  if (type === "downforce" || downforceLikeStreetTracks.has(circuitId))
    return "downforce";
  return "other";
}

async function main() {
  console.log("Loading calendar…");
  const calendarRaces = await jolpica.races(SEASON);
  const previousRaces = await jolpica.races(PREVIOUS);
  const today = new Date().toISOString().slice(0, 10);

  console.log("Loading completed rounds…");
  const rounds: RoundData[] = [];
  for (const race of calendarRaces.filter((r) => r.date < today)) {
    const data = await loadRound(SEASON, race);
    if (data.results.length) rounds.push(data);
  }
  const lastRound = rounds[rounds.length - 1];
  console.log(
    `  ${rounds.length} completed rounds, last: ${lastRound.race.raceName}`,
  );

  // ---------------------------------------------------------------- teams & drivers
  console.log("Building teams and drivers…");
  const lineup = new Map<string, string[]>();
  for (const r of lastRound.results) {
    const list = lineup.get(r.Constructor.constructorId) ?? [];
    list.push(r.Driver.driverId);
    lineup.set(r.Constructor.constructorId, list);
  }

  const constructorStandings = await jolpica.constructorStandings(SEASON);
  const driverStandings = await jolpica.driverStandings(SEASON);
  const driverInfo = new Map(
    (await jolpica.drivers(SEASON)).map((d) => [d.driverId, d]),
  );
  type OpenF1Driver = {
    name_acronym: string;
    team_colour: string | null;
    headshot_url: string | null;
  };
  const openF1 = await fetchCached<OpenF1Driver[]>(
    "https://api.openf1.org/v1/drivers?session_key=latest",
  );
  const openF1ByCode = new Map(openF1.map((d) => [d.name_acronym, d]));

  // Car pace: per round, each team's best qualifying lap vs pole (a "supertime").
  const teamGaps = new Map<string, { group: string; gap: number }[]>();
  for (const { race, qualifying } of rounds) {
    const best = new Map<string, number>();
    for (const q of qualifying) {
      const t = bestQualiTime(q);
      if (t === null) continue;
      const id = q.Constructor.constructorId;
      best.set(id, Math.min(best.get(id) ?? Infinity, t));
    }
    if (best.size < 8) continue;
    const pole = Math.min(...best.values());
    for (const [id, t] of best) {
      const list = teamGaps.get(id) ?? [];
      list.push({
        group: trackGroup(race.Circuit.circuitId),
        gap: ((t - pole) / pole) * 100,
      });
      teamGaps.set(id, list);
    }
  }

  const rawDeficit = new Map(
    [...teamGaps].map(([id, gaps]) => [id, median(gaps.map((g) => g.gap))]),
  );
  const fastest = Math.min(...rawDeficit.values());

  const teams: Team[] = constructorStandings.map((standing) => {
    const id = standing.Constructor.constructorId;
    const curated = curatedTeams[id];
    if (!curated) throw new Error(`No curated team entry for "${id}"`);
    const gaps = teamGaps.get(id) ?? [];
    const overall = rawDeficit.get(id) ?? NaN;

    // Shrink small samples toward zero so one odd weekend doesn't define the car.
    const groupDelta = (group: string) => {
      const xs = gaps.filter((g) => g.group === group).map((g) => g.gap);
      return xs.length
        ? ((median(xs) - overall) * xs.length) / (xs.length + 3)
        : 0;
    };

    // Retirements include crashes; assume roughly half are mechanical.
    const starts = rounds
      .flatMap((r) => r.results)
      .filter((r) => r.Constructor.constructorId === id);
    const retired = starts.filter((r) => r.status === "Retired").length;
    const retirementRate = (retired + 0.08 * 20) / (starts.length + 20);
    const car: Car = {
      paceDeficitPct: round(overall - fastest),
      powerTrackDeltaPct: round(groupDelta("power")),
      downforceTrackDeltaPct: round(groupDelta("downforce")),
      tyreWear: curated.tyreWear,
      reliability: round(1 - retirementRate / 2),
    };

    const driverCode = lineup.get(id)?.map((d) => driverInfo.get(d)?.code)[0];
    const colour =
      (driverCode && openF1ByCode.get(driverCode)?.team_colour) || "888888";

    return {
      id,
      name: standing.Constructor.name,
      shortName: curated.shortName,
      color: `#${colour.toUpperCase()}`,
      powerUnit: curated.powerUnit,
      mediaSlug: curated.mediaSlug,
      championship: {
        position: Number(standing.position),
        points: Number(standing.points),
      },
      car,
    };
  });

  const drivers: Driver[] = [];
  for (const team of teams) {
    const ids = lineup.get(team.id) ?? [];
    if (ids.length !== 2)
      warn(`${team.id} has ${ids.length} drivers in the last round`);

    // Split the team's average pace prior between teammates using their real qualifying gap.
    const priors = ids.map((id) => {
      const prior = curatedDrivers[id];
      if (!prior) throw new Error(`No curated ratings for driver "${id}"`);
      return prior;
    });
    const paces = priors.map((p) => p.pace);
    if (ids.length === 2) {
      const gaps: number[] = [];
      for (const { qualifying } of rounds) {
        const a = qualifying.find((q) => q.Driver.driverId === ids[0]);
        const b = qualifying.find((q) => q.Driver.driverId === ids[1]);
        const gap = a && b ? teammateGapPct(a, b) : null;
        if (gap !== null && Math.abs(gap) < 3) gaps.push(gap);
      }
      if (gaps.length >= 3) {
        // 0.1% of lap time ≈ 1 rating point. Blend 50/50 with the prior so one season of
        // qualifying doesn't override everything we know about a driver.
        const mean = (paces[0] + paces[1]) / 2;
        const diff = clamp(median(gaps) * 10, -12, 12);
        paces[0] = (paces[0] + mean - diff / 2) / 2;
        paces[1] = (paces[1] + mean + diff / 2) / 2;
      }
    }

    ids.forEach((id, i) => {
      const info = driverInfo.get(id);
      const standing = driverStandings.find((s) => s.Driver.driverId === id);
      const of1 = info?.code ? openF1ByCode.get(info.code) : undefined;
      const mediaRef = of1?.headshot_url
        ?.match(/\/([A-Z]{6}\d{2})_/)?.[1]
        ?.toLowerCase();
      if (!info?.code || !info.permanentNumber)
        throw new Error(`Missing Jolpica info for ${id}`);
      if (!mediaRef) warn(`No media reference for ${id}`);

      drivers.push({
        id,
        code: info.code,
        number: Number(info.permanentNumber),
        firstName: info.givenName,
        lastName: info.familyName,
        nationality: info.nationality ?? "",
        dateOfBirth: info.dateOfBirth ?? "",
        teamId: team.id,
        mediaRef: mediaRef ?? "",
        headshotUrl: of1?.headshot_url ?? null,
        championship: {
          position: Number(standing?.position ?? 0),
          points: Number(standing?.points ?? 0),
          wins: Number(standing?.wins ?? 0),
        },
        ratings: { ...priors[i], pace: clamp(Math.round(paces[i]), 50, 99) },
      });
    });
  }

  // ---------------------------------------------------------------- tracks
  console.log("Building tracks…");
  type Feature = {
    properties: { id: string; Name: string; length: number };
    geometry: { coordinates: LonLat[] };
  };
  const geo = await fetchCached<{ features: Feature[] }>(
    "https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-circuits.geojson",
  );

  const roundsByCircuit = new Map(
    rounds.map((r) => [r.race.Circuit.circuitId, r]),
  );
  const previousByCircuit = new Map<string, JRace>(
    previousRaces.map((r) => [r.Circuit.circuitId, r]),
  );
  const previousRound = new Map<string, RoundData>();
  const loadPrevious = async (circuitId: string) => {
    const race = previousByCircuit.get(circuitId);
    if (!race) return undefined;
    if (!previousRound.has(circuitId))
      previousRound.set(circuitId, await loadRound(PREVIOUS, race));
    return previousRound.get(circuitId);
  };

  // NaN when the source has no times (Jolpica is missing some sessions).
  const minOrNaN = (xs: (number | null)[]) => {
    const valid = xs.filter((t): t is number => t !== null);
    return valid.length ? Math.min(...valid) : NaN;
  };
  const poleOf = (r: RoundData) => minOrNaN(r.qualifying.map(bestQualiTime));
  const fastestLapOf = (r: RoundData) =>
    minOrNaN(r.results.map((x) => parseLapTime(x.FastestLap?.Time?.time)));

  // How much slower/faster 2026 cars are than 2025 cars, from circuits raced in both seasons.
  const ratios: number[] = [];
  for (const [circuitId, r] of roundsByCircuit) {
    const prev = await loadPrevious(circuitId);
    const ratio = prev ? poleOf(r) / poleOf(prev) : NaN;
    if (Number.isFinite(ratio)) ratios.push(ratio);
  }
  const seasonRatio = median(ratios);
  console.log(
    `  2026 vs 2025 pole ratio: ${seasonRatio.toFixed(4)} (from ${ratios.length} circuits)`,
  );

  const tracks: Track[] = [];
  const calendar: CalendarRound[] = [];
  const jolpicaPitLosses = new Map<string, number | null>();
  for (const race of calendarRaces) {
    const circuit = race.Circuit;
    const id = circuit.circuitId;
    const curated = curatedTracks[id];
    if (!curated) throw new Error(`No curated track entry for "${id}"`);

    // Match the GeoJSON outline by proximity to Jolpica's circuit coordinates.
    const location: LonLat = [
      Number(circuit.Location.long),
      Number(circuit.Location.lat),
    ];
    const match = geo.features
      .map((f) => ({
        f,
        d: Math.min(
          ...f.geometry.coordinates.map((c) => haversine(c, location)),
        ),
      }))
      .sort((a, b) => a.d - b.d)[0];
    if (match.d > 3000)
      throw new Error(
        `No outline within 3 km of ${id} (closest ${match.f.properties.id})`,
      );
    const feature = match.f;
    const lengthMeters = feature.properties.length;

    let coords = feature.geometry.coordinates;
    if (reversedGeometry.has(id))
      coords = [coords[0], ...coords.slice(1).reverse()];
    const path = roundPoints(
      scaleToLength(
        resampleClosed(
          smoothClosed(openRing(projectToMeters(coords))),
          PATH_POINTS,
        ),
        lengthMeters,
      ),
    );

    // Positive signed area = anticlockwise (y points north).
    if (!figureOfEightTracks.has(id)) {
      const anticlockwise = signedArea(path) > 0;
      if (anticlockwise !== anticlockwiseTracks.has(id)) {
        throw new Error(
          `${id}: outline runs ${anticlockwise ? "anticlockwise" : "clockwise"}, expected the opposite. ` +
            "Add it to reversedGeometry in scripts/curated/tracks.ts.",
        );
      }
    }

    // Lap times: this season's race if it has happened, otherwise last season's scaled to 2026 pace.
    const current = roundsByCircuit.get(id);
    const source = current ?? (await loadPrevious(id));
    if (!source)
      throw new Error(`No race data for ${id} in ${SEASON} or ${PREVIOUS}`);
    const scale = current ? 1 : seasonRatio;
    let pole = poleOf(source) * scale;
    let fastestLap = fastestLapOf(source) * scale;

    if (current) {
      const prev = await loadPrevious(id);
      const expected = prev ? poleOf(prev) * seasonRatio : NaN;
      if (Number.isFinite(expected) && Math.abs(pole / expected - 1) > 0.04) {
        warn(
          `${id}: 2026 pole ${pole.toFixed(3)} looks off (wet?), using scaled 2025 ${expected.toFixed(3)}`,
        );
        pole = expected;
      }
    }
    // Typical dry ratio of the fastest race lap to pole across the calendar.
    const RACE_LAP_TO_POLE = 1.043;
    if (
      Number.isFinite(fastestLap) &&
      (!Number.isFinite(pole) || fastestLap < pole * 0.995)
    ) {
      warn(
        `${id}: pole ${pole.toFixed(3)} slower than the fastest race lap (wet quali), estimating`,
      );
      pole = fastestLap / RACE_LAP_TO_POLE;
    }
    if (!Number.isFinite(pole))
      throw new Error(`No usable lap times for ${id}`);
    if (!Number.isFinite(fastestLap) || fastestLap / pole > 1.08) {
      warn(
        `${id}: fastest race lap ${fastestLap.toFixed(3)} looks off (wet race?), estimating from pole`,
      );
      fastestLap = pole * RACE_LAP_TO_POLE;
    }

    const raceDistance = id === "monaco" ? 260_000 : 305_000;
    const formulaLaps = Math.ceil(raceDistance / lengthMeters);
    const winner = source.results[0];
    const winnerLaps = Number(winner?.laps ?? 0);
    const laps =
      winner?.status === "Finished" && Math.abs(winnerLaps - formulaLaps) <= 1
        ? winnerLaps
        : formulaLaps;
    if (laps !== winnerLaps)
      warn(`${id}: winner did ${winnerLaps} laps, using ${laps}`);

    // Only for comparison in the summary table; the curated value is what we use.
    const jolpicaPitLoss = source.pitDurations.length
      ? round(median(source.pitDurations) - 2.5, 1)
      : null;
    jolpicaPitLosses.set(id, jolpicaPitLoss);

    tracks.push({
      id,
      name: curated.name,
      circuitName: circuit.circuitName,
      locality: circuit.Location.locality,
      country: circuit.Location.country,
      type: curated.type,
      lengthMeters,
      laps,
      poleTimeSeconds: round(pole),
      fastestRaceLapSeconds: round(fastestLap),
      timesSource: current ? SEASON : PREVIOUS,
      pitLaneLossSeconds: curated.pitLaneLossSeconds,
      tyreDegradation: curated.tyreDegradation,
      overtakingDifficulty: curated.overtakingDifficulty,
      safetyCarProbability: curated.safetyCarProbability,
      rainProbability: curated.rainProbability,
      path,
    });
    calendar.push({
      round: Number(race.round),
      name: race.raceName,
      date: race.date,
      trackId: id,
    });
  }

  // ---------------------------------------------------------------- write
  mkdirSync(OUT_DIR, { recursive: true });
  const write = (name: string, data: unknown, pretty = true) =>
    writeFileSync(
      join(OUT_DIR, name),
      JSON.stringify(data, null, pretty ? 2 : 0) + "\n",
    );
  write("teams.json", teams);
  write("drivers.json", drivers);
  write("tracks.json", tracks, false);
  write("calendar.json", calendar);
  write("meta.json", {
    season: SEASON,
    generatedAt: new Date().toISOString(),
    lastCompletedRound: Number(lastRound.race.round),
  });

  console.log(
    `\nWrote ${teams.length} teams, ${drivers.length} drivers, ${tracks.length} tracks.`,
  );
  console.table(
    teams.map((t) => ({
      team: t.shortName,
      deficitPct: t.car.paceDeficitPct,
      power: t.car.powerTrackDeltaPct,
      downforce: t.car.downforceTrackDeltaPct,
      reliability: t.car.reliability,
    })),
  );
  console.table(
    drivers.map((d) => ({
      driver: d.code,
      team: d.teamId,
      pace: d.ratings.pace,
      media: d.mediaRef,
    })),
  );
  console.table(
    tracks.map((t) => ({
      track: t.id,
      laps: t.laps,
      pole: t.poleTimeSeconds,
      fastest: t.fastestRaceLapSeconds,
      src: t.timesSource,
      pitLoss: t.pitLaneLossSeconds,
      jolpicaPitLoss: jolpicaPitLosses.get(t.id),
    })),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
