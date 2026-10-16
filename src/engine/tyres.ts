import type { Compound, DryCompound } from "./types";

export const DRY_COMPOUNDS: DryCompound[] = ["soft", "medium", "hard"];

export const isDry = (c: Compound): c is DryCompound =>
  c === "soft" || c === "medium" || c === "hard";

/** Lap time offset on a dry track vs a fresh soft, in seconds for a 90 s lap. */
const DRY_OFFSET: Record<Compound, number> = {
  soft: 0,
  medium: 0.5,
  hard: 0.95,
  intermediate: 4.0,
  wet: 7.0,
};

/** Base wear per lap in % at an average-degradation track. */
const BASE_WEAR: Record<Compound, number> = {
  soft: 5.5,
  medium: 3.2,
  hard: 2.0,
  intermediate: 2.6,
  wet: 2.2,
};

/** Extra time on the out-lap while the tyres come up to temperature. */
export const OUT_LAP_PENALTY: Record<Compound, number> = {
  soft: 0.6,
  medium: 0.9,
  hard: 1.4,
  intermediate: 0.8,
  wet: 0.8,
};

/** Wear above which a puncture becomes possible. */
export const PUNCTURE_WEAR = 92;

/** Track degradation rating (1..5) as a wear multiplier. */
export function degradationFactor(tyreDegradation: number): number {
  return 0.55 + 0.15 * tyreDegradation; // 1 → 0.7, 3 → 1.0, 5 → 1.3
}

export type WearInputs = {
  compound: Compound;
  tyreDegradation: number;
  carTyreWear: number;
  /** Driver tyre-management rating, 0..100. */
  tyreManagement: number;
  /** Pace-mode multiplier (push wears more). */
  paceModeWear: number;
  wetness: number;
};

/** Tyre wear in % for one lap. */
export function wearPerLap(i: WearInputs): number {
  const driver = 1 + (85 - i.tyreManagement) * 0.01;
  let wear =
    BASE_WEAR[i.compound] *
    degradationFactor(i.tyreDegradation) *
    i.carTyreWear *
    driver *
    i.paceModeWear;
  // Wet tyres overheat and shred on a drying track; slicks wear less in the wet.
  if (i.compound === "intermediate" && i.wetness < 0.3)
    wear *= 1 + (0.3 - i.wetness) * 8;
  if (i.compound === "wet" && i.wetness < 0.55)
    wear *= 1 + (0.55 - i.wetness) * 8;
  if (isDry(i.compound)) wear *= 1 - Math.min(i.wetness, 0.6) * 0.5;
  return wear;
}

/** Time lost to tyre wear in seconds: gentle at first, then a cliff past 70%. */
export function wearPenalty(wear: number): number {
  const cliff = Math.max(0, wear - 70);
  return 0.025 * wear + cliff * cliff * 0.008;
}

/** Compound pace offset on a dry track, scaled to the track's lap time. */
export function compoundOffset(
  compound: Compound,
  referenceLap: number,
): number {
  return DRY_OFFSET[compound] * (referenceLap / 90);
}

/**
 * Extra time from running the wrong tyre for the conditions, relative to the ideal tyre.
 * Crossovers: slick → inter at ~17% wetness, inter → full wet at ~70%.
 */
export function conditionPenalty(
  compound: Compound,
  wetness: number,
  referenceLap: number,
): number {
  const k = referenceLap / 90;
  let penalty: number;
  if (isDry(compound)) {
    penalty = Math.max(0, wetness - 0.12) * 30;
  } else if (compound === "intermediate") {
    // DRY_OFFSET already covers the dry-track deficit; only penalise standing water here.
    penalty =
      Math.max(0, wetness - 0.7) * 20 -
      DRY_OFFSET.intermediate * Math.min(1, wetness / 0.3);
  } else {
    penalty = -DRY_OFFSET.wet * Math.min(1, wetness / 0.6);
  }
  return penalty * k;
}

/** Best tyre for the given wetness. */
export function idealCompoundFor(
  wetness: number,
): "dry" | "intermediate" | "wet" {
  if (wetness < 0.17) return "dry";
  if (wetness < 0.7) return "intermediate";
  return "wet";
}

/** Laps a compound can run before reaching the given wear, for strategy planning. */
export function stintLife(wearRate: number, maxWear = 75): number {
  return Math.floor(maxWear / wearRate);
}
