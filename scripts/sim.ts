/**
 * Run races from the command line.
 *
 *   npm run sim -- --track monza --seed 7
 *   npm run sim -- --track monaco --laps 20 --weather mixed
 *   npm run sim -- --track silverstone --runs 200     (aggregate statistics)
 */
import { parseArgs } from "node:util";
import { drivers, getTrack, teams } from "../src/data";
import { createRace, type Race, type WeatherMode } from "../src/engine";

const { values } = parseArgs({
  options: {
    track: { type: "string", default: "monza" },
    seed: { type: "string", default: "1" },
    laps: { type: "string" },
    weather: { type: "string", default: "auto" },
    runs: { type: "string", default: "1" },
  },
});

const track = getTrack(values.track!);
const runs = Number(values.runs);
const baseSeed = Number(values.seed);

const fmt = (s: number | null) => {
  if (s === null) return "-";
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(3).padStart(6, "0")}`;
};
const fmtTotal = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${(s % 60).toFixed(3).padStart(6, "0")}`;
};

function makeRace(seed: number): Race {
  return createRace({
    seed,
    track,
    teams,
    drivers,
    laps: values.laps ? Number(values.laps) : undefined,
    weather: values.weather as WeatherMode,
  });
}

if (runs === 1) {
  const race = makeRace(baseSeed);
  console.log(`\n${track.name} · ${race.laps} laps · seed ${baseSeed}\n`);
  if (race.qualifying) {
    console.log(
      "Grid: " +
        race.qualifying
          .map((q) => `${q.position}.${race.carByDriver(q.driverId)!.code}`)
          .join(" "),
    );
  }
  const start = performance.now();
  const results = race.run();
  const ms = performance.now() - start;

  console.log("\nEvents:");
  for (const e of race.events) {
    const who = "car" in e ? race.cars[e.car].code : "";
    if (
      [
        "lap",
        "overtake",
        "fastest-lap",
        "finished",
        "start",
        "tyre-warning",
        "pit-exit",
      ].includes(e.type)
    )
      continue;
    const extra = e.type === "pit-entry" ? ` → ${e.compound}` : "";
    console.log(
      `  L${String(e.lap).padStart(2)} ${fmt(e.time).padStart(9)}  ${e.type} ${who}${extra}`,
    );
  }

  console.log("\nResult:");
  console.table(
    results.map((r) => {
      const car = race.carByDriver(r.driverId)!;
      return {
        pos: r.position,
        driver: r.code,
        team: car.teamId,
        grid: r.gridPosition,
        status: r.status,
        laps: r.laps,
        time:
          r.position === 1 && r.totalTime
            ? fmtTotal(r.totalTime)
            : r.gap !== null
              ? `+${r.gap.toFixed(3)}`
              : r.status,
        best: fmt(r.bestLap),
        stints: car.stints
          .map(
            (s) =>
              `${s.compound[0].toUpperCase()}${(s.endLap ?? car.lap) - s.startLap}`,
          )
          .join(" "),
        pts: r.points,
      };
    }),
  );
  const overtakes = race.events.filter((e) => e.type === "overtake").length;
  console.log(
    `Overtakes: ${overtakes} · SC/VSC: ${race.safetyCar.deployments.map((d) => `${d.type}@L${d.lap}`).join(", ") || "none"} · ` +
      `fastest lap: ${race.fastestLap ? `${race.cars[race.fastestLap.car].code} ${fmt(race.fastestLap.time)}` : "-"} · ` +
      `simulated in ${ms.toFixed(0)} ms`,
  );
} else {
  const wins = new Map<string, number>();
  const podiums = new Map<string, number>();
  let stops = 0;
  let classifiedCars = 0;
  let dnfs = 0;
  let racesWithSc = 0;
  let racesWithRain = 0;
  let overtakes = 0;
  let duration = 0;
  let medianLapSum = 0;
  const start = performance.now();

  for (let i = 0; i < runs; i++) {
    const race = makeRace(baseSeed + i);
    const results = race.run();
    const winner = race.carByDriver(results[0].driverId)!;
    wins.set(winner.code, (wins.get(winner.code) ?? 0) + 1);
    for (const r of results.slice(0, 3))
      podiums.set(r.code, (podiums.get(r.code) ?? 0) + 1);
    for (const r of results) {
      if (r.status === "dnf") dnfs++;
      else {
        stops += r.pitStops;
        classifiedCars++;
      }
    }
    if (race.safetyCar.deployments.some((d) => d.type === "sc")) racesWithSc++;
    if (race.weather.timeline.some((k) => k.rain > 0)) racesWithRain++;
    overtakes += race.events.filter((e) => e.type === "overtake").length;
    duration += winner.finishTime ?? 0;
    const laps = winner.lapTimes.slice(1).sort((a, b) => a - b);
    medianLapSum += laps[laps.length >> 1] ?? 0;
  }

  const pct = (n: number) => `${((n / runs) * 100).toFixed(1)}%`;
  console.log(
    `\n${track.name} · ${runs} races in ${((performance.now() - start) / 1000).toFixed(1)} s\n`,
  );
  console.table(
    [...wins.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([code, n]) => ({
        driver: code,
        wins: pct(n),
        podiums: pct(podiums.get(code) ?? 0),
      })),
  );
  console.log(
    `Avg pit stops per finisher: ${(stops / classifiedCars).toFixed(2)}`,
  );
  console.log(`Avg DNFs per race: ${(dnfs / runs).toFixed(2)}`);
  console.log(
    `Races with SC: ${pct(racesWithSc)} (track history: ${(track.safetyCarProbability * 100).toFixed(0)}%)`,
  );
  console.log(
    `Races with rain: ${pct(racesWithRain)} (track: ${(track.rainProbability * 100).toFixed(0)}%)`,
  );
  console.log(`Avg overtakes per race: ${(overtakes / runs).toFixed(1)}`);
  console.log(`Avg race duration: ${fmtTotal(duration / runs)}`);
  console.log(
    `Avg winner median lap: ${fmt(medianLapSum / runs)} (fastest race lap in data: ${fmt(track.fastestRaceLapSeconds)})`,
  );
}
