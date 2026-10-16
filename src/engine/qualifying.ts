import type { Driver, Team, Track } from "@/data/types";
import { carFactor, driverDelta, referenceLap } from "./pace";
import { createRng } from "./rng";
import { conditionPenalty } from "./tyres";
import type { QualifyingResult } from "./types";

/** Track evolution between sessions, as a lap-time multiplier per session. */
const EVOLUTION = [1, 0.997, 0.994];

/**
 * Instant three-part knockout qualifying: Q1 drops the slowest six, Q2 the next six, and the
 * top ten set their grid in Q3. Each session is a single best lap with some variation.
 */
export function simulateQualifying(opts: {
  seed: number;
  track: Track;
  teams: Team[];
  drivers: Driver[];
  wetness?: number;
}): QualifyingResult[] {
  const { track, drivers } = opts;
  const wetness = opts.wetness ?? 0;
  const rng = createRng(opts.seed ^ 0x9e3779b9);
  const teamById = new Map(opts.teams.map((t) => [t.id, t]));
  // Qualifying laps on low fuel and fresh softs are a little quicker than the race reference.
  const ref =
    track.poleTimeSeconds / (track.fastestRaceLapSeconds / referenceLap(track));

  const lapTime = (driver: Driver, session: number) => {
    const team = teamById.get(driver.teamId)!;
    const base =
      ref * carFactor(team, track) +
      driverDelta(driver, ref, wetness) +
      (wetness > 0.17
        ? conditionPenalty("intermediate", wetness, ref) + 4 * (ref / 90)
        : 0) +
      wetness * 9 * (ref / 90);
    const sigma =
      (0.0008 + (100 - driver.ratings.consistency) * 0.00004) *
      ref *
      (1 + wetness);
    // A small chance of a scrappy lap (traffic, a lock-up, a lap deleted for track limits).
    const scrappy = rng.chance(0.03 + wetness * 0.05) ? rng.range(0.3, 1.5) : 0;
    return base * EVOLUTION[session] + rng.normal(0, sigma) + scrappy;
  };

  const times = new Map(
    drivers.map((d) => [d.id, [null, null, null] as (number | null)[]]),
  );
  let remaining = [...drivers];
  const cutoffs = [
    Math.max(0, drivers.length - 6),
    Math.max(0, drivers.length - 12),
    0,
  ];
  const eliminated: { driver: Driver; reached: 1 | 2 }[] = [];

  for (let session = 0; session < 3; session++) {
    for (const d of remaining) times.get(d.id)![session] = lapTime(d, session);
    remaining.sort(
      (a, b) => times.get(a.id)![session]! - times.get(b.id)![session]!,
    );
    if (session < 2) {
      const keep = session === 0 ? cutoffs[0] : cutoffs[1];
      const out = remaining.slice(keep);
      remaining = remaining.slice(0, keep);
      // Eliminated drivers are classified by their time in the session they went out in.
      eliminated.unshift(
        ...out.map((driver) => ({ driver, reached: (session + 1) as 1 | 2 })),
      );
    }
  }

  const order = [
    ...remaining.map((driver) => ({ driver, reached: 3 as const })),
    ...eliminated,
  ];
  return order.map(({ driver, reached }, i) => {
    const [q1, q2, q3] = times.get(driver.id)!;
    return {
      position: i + 1,
      driverId: driver.id,
      teamId: driver.teamId,
      q1,
      q2,
      q3,
      reached,
    };
  });
}
