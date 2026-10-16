import type { TrackType } from "../../src/data/types";

/**
 * Per-circuit characteristics the APIs don't provide. Keyed by Jolpica circuitId.
 * tyreDegradation and overtakingDifficulty are 1..5; probabilities are per race.
 * Pit lane loss is curated because Jolpica pit durations are measured inconsistently between venues.
 */
export const curatedTracks: Record<
  string,
  {
    name: string;
    type: TrackType;
    tyreDegradation: number;
    overtakingDifficulty: number;
    safetyCarProbability: number;
    rainProbability: number;
    /** Green-flag time lost by a pit stop, excluding the stationary time. */
    pitLaneLossSeconds: number;
  }
> = {
  albert_park: {
    pitLaneLossSeconds: 19.5,
    name: "Melbourne",
    type: "balanced",
    tyreDegradation: 2,
    overtakingDifficulty: 3,
    safetyCarProbability: 0.6,
    rainProbability: 0.15,
  },
  shanghai: {
    pitLaneLossSeconds: 22.5,
    name: "Shanghai",
    type: "balanced",
    tyreDegradation: 4,
    overtakingDifficulty: 2,
    safetyCarProbability: 0.35,
    rainProbability: 0.2,
  },
  suzuka: {
    pitLaneLossSeconds: 22.5,
    name: "Suzuka",
    type: "downforce",
    tyreDegradation: 4,
    overtakingDifficulty: 4,
    safetyCarProbability: 0.35,
    rainProbability: 0.25,
  },
  miami: {
    pitLaneLossSeconds: 20.5,
    name: "Miami",
    type: "street",
    tyreDegradation: 3,
    overtakingDifficulty: 3,
    safetyCarProbability: 0.45,
    rainProbability: 0.2,
  },
  villeneuve: {
    pitLaneLossSeconds: 18.5,
    name: "Montréal",
    type: "power",
    tyreDegradation: 2,
    overtakingDifficulty: 2,
    safetyCarProbability: 0.6,
    rainProbability: 0.25,
  },
  monaco: {
    pitLaneLossSeconds: 19.5,
    name: "Monaco",
    type: "street",
    tyreDegradation: 1,
    overtakingDifficulty: 5,
    safetyCarProbability: 0.55,
    rainProbability: 0.15,
  },
  catalunya: {
    pitLaneLossSeconds: 21.5,
    name: "Barcelona",
    type: "downforce",
    tyreDegradation: 4,
    overtakingDifficulty: 4,
    safetyCarProbability: 0.25,
    rainProbability: 0.1,
  },
  red_bull_ring: {
    pitLaneLossSeconds: 20.5,
    name: "Spielberg",
    type: "power",
    tyreDegradation: 3,
    overtakingDifficulty: 2,
    safetyCarProbability: 0.35,
    rainProbability: 0.25,
  },
  silverstone: {
    pitLaneLossSeconds: 20.5,
    name: "Silverstone",
    type: "downforce",
    tyreDegradation: 4,
    overtakingDifficulty: 2,
    safetyCarProbability: 0.4,
    rainProbability: 0.35,
  },
  spa: {
    pitLaneLossSeconds: 18.5,
    name: "Spa",
    type: "power",
    tyreDegradation: 3,
    overtakingDifficulty: 1,
    safetyCarProbability: 0.4,
    rainProbability: 0.4,
  },
  hungaroring: {
    pitLaneLossSeconds: 20.5,
    name: "Budapest",
    type: "downforce",
    tyreDegradation: 3,
    overtakingDifficulty: 5,
    safetyCarProbability: 0.25,
    rainProbability: 0.15,
  },
  zandvoort: {
    pitLaneLossSeconds: 18.5,
    name: "Zandvoort",
    type: "downforce",
    tyreDegradation: 3,
    overtakingDifficulty: 5,
    safetyCarProbability: 0.5,
    rainProbability: 0.3,
  },
  monza: {
    pitLaneLossSeconds: 24,
    name: "Monza",
    type: "power",
    tyreDegradation: 2,
    overtakingDifficulty: 2,
    safetyCarProbability: 0.35,
    rainProbability: 0.1,
  },
  madring: {
    pitLaneLossSeconds: 22,
    name: "Madrid",
    type: "street",
    tyreDegradation: 3,
    overtakingDifficulty: 3,
    safetyCarProbability: 0.55,
    rainProbability: 0.1,
  },
  baku: {
    pitLaneLossSeconds: 20,
    name: "Baku",
    type: "street",
    tyreDegradation: 2,
    overtakingDifficulty: 1,
    safetyCarProbability: 0.65,
    rainProbability: 0.05,
  },
  sepang: {
    pitLaneLossSeconds: 21,
    name: "Sepang",
    type: "balanced",
    tyreDegradation: 5,
    overtakingDifficulty: 2,
    safetyCarProbability: 0.3,
    rainProbability: 0.45,
  },
  marina_bay: {
    pitLaneLossSeconds: 28.5,
    name: "Singapore",
    type: "street",
    tyreDegradation: 3,
    overtakingDifficulty: 5,
    safetyCarProbability: 0.8,
    rainProbability: 0.25,
  },
  americas: {
    pitLaneLossSeconds: 21,
    name: "Austin",
    type: "balanced",
    tyreDegradation: 4,
    overtakingDifficulty: 2,
    safetyCarProbability: 0.35,
    rainProbability: 0.1,
  },
  rodriguez: {
    pitLaneLossSeconds: 21.5,
    name: "Mexico City",
    type: "power",
    tyreDegradation: 2,
    overtakingDifficulty: 3,
    safetyCarProbability: 0.45,
    rainProbability: 0.1,
  },
  interlagos: {
    pitLaneLossSeconds: 21,
    name: "São Paulo",
    type: "balanced",
    tyreDegradation: 3,
    overtakingDifficulty: 2,
    safetyCarProbability: 0.6,
    rainProbability: 0.4,
  },
  vegas: {
    pitLaneLossSeconds: 21,
    name: "Las Vegas",
    type: "street",
    tyreDegradation: 2,
    overtakingDifficulty: 1,
    safetyCarProbability: 0.5,
    rainProbability: 0.02,
  },
  losail: {
    pitLaneLossSeconds: 25,
    name: "Lusail",
    type: "balanced",
    tyreDegradation: 5,
    overtakingDifficulty: 3,
    safetyCarProbability: 0.35,
    rainProbability: 0.02,
  },
  yas_marina: {
    pitLaneLossSeconds: 21.5,
    name: "Abu Dhabi",
    type: "balanced",
    tyreDegradation: 2,
    overtakingDifficulty: 3,
    safetyCarProbability: 0.25,
    rainProbability: 0.01,
  },
};

/** Street circuits that behave like power tracks for the car-strength split. */
export const powerLikeStreetTracks = new Set(["baku", "vegas"]);

/** Street circuits that behave like downforce tracks for the car-strength split. */
export const downforceLikeStreetTracks = new Set(["monaco", "marina_bay"]);

/** Circuits whose GeoJSON runs against the race direction. */
export const reversedGeometry = new Set<string>(["marina_bay"]);

/** Circuits raced anti-clockwise; every other one is clockwise. The script checks the outline against this. */
export const anticlockwiseTracks = new Set([
  "miami",
  "baku",
  "marina_bay",
  "americas",
  "interlagos",
  "vegas",
  "yas_marina",
]);

/** Figure-of-eight layouts, where the outline's winding says nothing about direction. */
export const figureOfEightTracks = new Set(["suzuka"]);
