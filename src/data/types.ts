/** Shapes of the generated JSON in src/data. Produced by `npm run data`. */

export type PowerUnit =
  "Mercedes" | "Ferrari" | "Honda" | "Red Bull Ford" | "Audi";

export type Car = {
  /** Median qualifying gap to the fastest car over the season, in % (0 = fastest). */
  paceDeficitPct: number;
  /** Extra gap on power tracks vs the car's average, in % (negative = relatively stronger). */
  powerTrackDeltaPct: number;
  /** Extra gap on downforce tracks vs the car's average, in % (negative = relatively stronger). */
  downforceTrackDeltaPct: number;
  /** Tyre wear multiplier (1 = average, lower is kinder on tyres). */
  tyreWear: number;
  /** Probability of reaching the finish without a retirement, 0..1. */
  reliability: number;
};

export type Team = {
  /** Jolpica constructorId, e.g. "red_bull". */
  id: string;
  name: string;
  shortName: string;
  /** Team colour, "#RRGGBB". */
  color: string;
  powerUnit: PowerUnit;
  /** Slug used by the formula1.com media CDN, e.g. "redbullracing". */
  mediaSlug: string;
  championship: { position: number; points: number };
  car: Car;
};

export type DriverRatings = {
  /** One-lap and race pace, 0..100. */
  pace: number;
  /** Attacking and defending wheel to wheel, 0..100. */
  racecraft: number;
  /** Keeping tyres alive over a stint, 0..100. */
  tyreManagement: number;
  /** Pace and control in the wet, 0..100. */
  wetSkill: number;
  /** Avoiding mistakes and incidents, 0..100. */
  consistency: number;
};

export type Driver = {
  /** Jolpica driverId, e.g. "max_verstappen". */
  id: string;
  /** Three-letter code, e.g. "VER". */
  code: string;
  number: number;
  firstName: string;
  lastName: string;
  nationality: string;
  dateOfBirth: string;
  teamId: string;
  /** Reference used by the formula1.com media CDN, e.g. "maxver01". */
  mediaRef: string;
  /** Headshot URL reported by OpenF1, used as a secondary image source. */
  headshotUrl: string | null;
  championship: { position: number; points: number; wins: number };
  ratings: DriverRatings;
};

export type TrackType = "power" | "balanced" | "downforce" | "street";

/** A point in local metres: x east, y north, origin at the track centre. */
export type Point = [x: number, y: number];

export type Track = {
  /** Jolpica circuitId, e.g. "monza". */
  id: string;
  name: string;
  circuitName: string;
  locality: string;
  country: string;
  type: TrackType;
  lengthMeters: number;
  laps: number;
  /** Pole lap time in seconds (2026 car estimate). */
  poleTimeSeconds: number;
  /** Fastest race lap in seconds (2026 car estimate). */
  fastestRaceLapSeconds: number;
  /** Season the lap times come from; 2025 values are scaled to 2026 pace. */
  timesSource: 2025 | 2026;
  /** Time lost driving through the pit lane, excluding the stationary stop. */
  pitLaneLossSeconds: number;
  /** Tyre degradation, 1 (low) .. 5 (high). */
  tyreDegradation: number;
  /** Overtaking difficulty, 1 (easy) .. 5 (very hard). */
  overtakingDifficulty: number;
  /** Probability of at least one Safety Car in a race, 0..1. */
  safetyCarProbability: number;
  /** Probability of rain during a race, 0..1. */
  rainProbability: number;
  /** Closed racing line, evenly spaced, starting at the start/finish line in race direction. */
  path: Point[];
};

export type CalendarRound = {
  round: number;
  name: string;
  date: string;
  trackId: string;
};
