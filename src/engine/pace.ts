import type { Driver, Team, Track } from "@/data/types";
import type { Rng } from "./rng";
import {
  compoundOffset,
  conditionPenalty,
  OUT_LAP_PENALTY,
  wearPenalty,
} from "./tyres";
import type { Compound, PaceMode } from "./types";

/** Lap time sensitivity to fuel load. */
export const SECONDS_PER_KG = 0.03;
/** Race fuel for a full Grand Prix distance (2026 rules). */
export const FULL_RACE_FUEL_KG = 70;

export const PACE_MODE = {
  push: { time: -0.5, wear: 1.25, risk: 1.3 },
  balanced: { time: 0, wear: 1, risk: 1 },
  conserve: { time: 0.35, wear: 0.65, risk: 0.8 },
} satisfies Record<PaceMode, { time: number; wear: number; risk: number }>;

/**
 * Reference lap: the fastest car with a 95-rated driver, on fresh softs, with no fuel, on a dry
 * track. The real fastest race lap is set near the end of the race on fresh-ish tyres, so the
 * reference sits a little below it.
 */
export function referenceLap(track: Track): number {
  return track.fastestRaceLapSeconds - 0.3;
}

/** Car performance as a lap-time multiplier for this kind of track. */
export function carFactor(team: Team, track: Track): number {
  const { car } = team;
  const typeDelta =
    track.type === "power"
      ? car.powerTrackDeltaPct
      : track.type === "downforce"
        ? car.downforceTrackDeltaPct
        : 0;
  return 1 + (car.paceDeficitPct + typeDelta) / 100;
}

/** Driver pace gap to a 95-rated driver, in seconds. */
export function driverDelta(
  driver: Driver,
  reference: number,
  wetness: number,
): number {
  const dry = (95 - driver.ratings.pace) * 0.0004 * reference;
  const wet = wetness * (85 - driver.ratings.wetSkill) * 0.035;
  return dry + wet;
}

export type LapInputs = {
  track: Track;
  team: Team;
  driver: Driver;
  compound: Compound;
  wear: number;
  fuelKg: number;
  wetness: number;
  paceMode: PaceMode;
  outLap: boolean;
};

/** Expected lap time with no randomness and no traffic. */
export function expectedLapTime(i: LapInputs): number {
  const ref = referenceLap(i.track);
  return (
    ref * carFactor(i.team, i.track) +
    driverDelta(i.driver, ref, i.wetness) +
    compoundOffset(i.compound, ref) +
    conditionPenalty(i.compound, i.wetness, ref) +
    wearPenalty(i.wear) +
    i.fuelKg * SECONDS_PER_KG +
    i.wetness * 9 * (ref / 90) +
    PACE_MODE[i.paceMode].time +
    (i.outLap ? OUT_LAP_PENALTY[i.compound] : 0)
  );
}

/** Standard deviation of a driver's lap-to-lap variation, in seconds. */
export function lapNoiseSigma(driver: Driver, wetness: number): number {
  return (0.12 + (100 - driver.ratings.consistency) * 0.012) * (1 + wetness);
}

/** Lap-to-lap variation and the odd mistake, driven by the driver's consistency. */
export function lapNoise(
  driver: Driver,
  wetness: number,
  rng: Rng,
): { noise: number; mistake: boolean } {
  const consistency = driver.ratings.consistency;
  let noise = rng.normal(0, lapNoiseSigma(driver, wetness));
  const mistakeChance = (0.01 + (100 - consistency) * 0.0015) * (1 + wetness);
  const mistake = rng.chance(mistakeChance);
  if (mistake) noise += rng.range(0.8, 3);
  return { noise, mistake };
}
