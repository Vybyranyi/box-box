import type { Rng } from "./rng";
import {
  compoundOffset,
  DRY_COMPOUNDS,
  idealCompoundFor,
  isDry,
  OUT_LAP_PENALTY,
  wearPenalty,
} from "./tyres";
import type { Compound, DryCompound, StrategyPlan } from "./types";

export type WearRates = Record<DryCompound, number>;

/** AI pits before the tyre falls off the cliff. */
export const MAX_PLANNED_WEAR = 80;
/** Average stationary time, used for planning. */
export const PLANNED_STATIONARY = 2.4;

export type PlanInput = {
  /** First lap of the plan (laps completed so far). */
  fromLap: number;
  totalLaps: number;
  wearRates: WearRates;
  referenceLap: number;
  pitLaneLoss: number;
  /** Track overtaking difficulty 1..5: track position lost in a stop is harder to win back. */
  overtakingDifficulty: number;
  requireTwoCompounds: boolean;
  /** Compounds already used this race. */
  usedCompounds: Compound[];
  /**
   * Tyre currently fitted, if the plan continues an ongoing stint rather than starting fresh.
   * `rate` overrides the wear rate for this stint (e.g. the car is pushing or conserving).
   */
  current?: { compound: DryCompound; wear: number; rate?: number };
  /** Picks among near-optimal plans at random; without it, the best plan is returned. */
  rng?: Rng;
};

type Candidate = {
  stints: { compound: DryCompound; endLap: number }[];
  time: number;
};

/** Time for `laps` laps on one set, excluding everything common to all strategies. */
function stintCost(
  compound: DryCompound,
  laps: number,
  rate: number,
  startWear: number,
  ref: number,
) {
  let time = laps * compoundOffset(compound, ref);
  for (let i = 0; i < laps; i++)
    time += wearPenalty(startWear + (i + 0.5) * rate);
  return time;
}

/**
 * Build the cheapest 0, 1 and 2-stop plans for the rest of the race and pick one of the
 * near-optimal ones at random, so the AI teams don't all run the same strategy.
 */
export function planStrategy(input: PlanInput): StrategyPlan {
  const { fromLap, totalLaps, wearRates, referenceLap: ref, rng } = input;
  const remaining = totalLaps - fromLap;
  const stopCost =
    input.pitLaneLoss + PLANNED_STATIONARY + input.overtakingDifficulty * 2.5;

  // cost[c][n]: cost of a fresh n-lap stint on compound c (Infinity past the wear limit).
  const cost = {} as Record<DryCompound, number[]>;
  for (const c of DRY_COMPOUNDS) {
    const rate = wearRates[c];
    cost[c] = [0];
    for (let n = 1; n <= remaining; n++) {
      cost[c][n] =
        n * rate > MAX_PLANNED_WEAR
          ? Infinity
          : stintCost(c, n, rate, 0, ref) + OUT_LAP_PENALTY[c];
    }
  }
  // The tyre already fitted can always do the lap in progress (boxing at its end); past that it
  // gets the same wear limit as a fresh set, so the planned stop doesn't drift later lap by lap.
  const currentCost: number[] = [0];
  if (input.current) {
    const { compound, wear } = input.current;
    const rate = input.current.rate ?? wearRates[compound];
    for (let n = 1; n <= remaining; n++) {
      currentCost[n] =
        n > 1 && wear + n * rate > MAX_PLANNED_WEAR
          ? Infinity
          : stintCost(compound, n, rate, wear, ref);
    }
  }

  const wetUsed = input.usedCompounds.some((c) => !isDry(c));
  const usedDry = new Set(input.usedCompounds.filter(isDry));
  const satisfiesRule = (compounds: DryCompound[]) =>
    !input.requireTwoCompounds ||
    wetUsed ||
    new Set([...usedDry, ...compounds]).size >= 2;

  // First stint options: either the tyre already fitted, or any fresh compound at the start.
  const firstOptions: { compound: DryCompound; costs: number[] }[] =
    input.current
      ? [{ compound: input.current.compound, costs: currentCost }]
      : DRY_COMPOUNDS.map((c) => ({ compound: c, costs: cost[c] }));

  const candidates: Candidate[] = [];
  const minStint = Math.min(5, Math.max(1, Math.floor(remaining / 4)));
  // An ongoing stint can end on the lap in progress; only fresh stints need a minimum length.
  const minFirst = input.current ? 1 : minStint;

  for (const first of firstOptions) {
    // No more stops.
    if (satisfiesRule([first.compound]) && first.costs[remaining] < Infinity) {
      candidates.push({
        stints: [{ compound: first.compound, endLap: totalLaps }],
        time: first.costs[remaining],
      });
    }
    for (const second of DRY_COMPOUNDS) {
      // One more stop.
      if (satisfiesRule([first.compound, second])) {
        let best: Candidate | null = null;
        for (let a = minFirst; a <= remaining - minStint; a++) {
          const time = first.costs[a] + cost[second][remaining - a] + stopCost;
          if (time < (best?.time ?? Infinity)) {
            best = {
              time,
              stints: [
                { compound: first.compound, endLap: fromLap + a },
                { compound: second, endLap: totalLaps },
              ],
            };
          }
        }
        if (best) candidates.push(best);
      }
      // Two more stops.
      for (const third of DRY_COMPOUNDS) {
        if (!satisfiesRule([first.compound, second, third])) continue;
        let best: Candidate | null = null;
        for (let a = minFirst; a <= remaining - 2 * minStint; a++) {
          if (first.costs[a] === Infinity) continue;
          for (let b = minStint; a + b <= remaining - minStint; b++) {
            const time =
              first.costs[a] +
              cost[second][b] +
              cost[third][remaining - a - b] +
              2 * stopCost;
            if (time < (best?.time ?? Infinity)) {
              best = {
                time,
                stints: [
                  { compound: first.compound, endLap: fromLap + a },
                  { compound: second, endLap: fromLap + a + b },
                  { compound: third, endLap: totalLaps },
                ],
              };
            }
          }
        }
        if (best) candidates.push(best);
      }
    }
  }

  const finite = candidates.filter((c) => Number.isFinite(c.time));
  if (finite.length === 0) {
    // Nothing fits within the wear limit (very short or very long stints): just run the hard.
    return {
      stints: [
        { compound: input.current?.compound ?? "hard", endLap: totalLaps },
      ],
    };
  }

  const bestTime = Math.min(...finite.map((c) => c.time));
  if (!rng) return { stints: finite.find((c) => c.time === bestTime)!.stints };

  // Softmax over candidates within a few seconds of the best.
  const pool = finite.filter((c) => c.time - bestTime < 3);
  const weights = pool.map((c) => Math.exp(-(c.time - bestTime) / 1.0));
  let pick = rng.next() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < pool.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return { stints: pool[i].stints };
  }
  return { stints: pool[pool.length - 1].stints };
}

/** Planned stop lap with some noise: teams react to traffic and gaps, not a fixed script. */
export function jitterStopLap(
  endLap: number,
  totalLaps: number,
  lap: number,
  rng: Rng,
): number | null {
  if (endLap >= totalLaps) return null;
  const jittered = endLap + Math.round(rng.normal(0, 1.2));
  return Math.min(totalLaps - 1, Math.max(lap + 1, jittered));
}

export type PitDecisionInput = {
  lap: number;
  totalLaps: number;
  compound: Compound;
  wear: number;
  tyreAge: number;
  wetness: number;
  trackStatus: "green" | "sc" | "vsc";
  /** Whether this car has already stopped under the current neutralisation. */
  stoppedUnderThisNeutralisation: boolean;
  plan: StrategyPlan;
  nextStopLap: number | null;
  weatherMismatchLaps: number;
  weatherReaction: number;
  requireTwoCompounds: boolean;
  usedCompounds: Compound[];
  rng: Rng;
};

export type PitDecision =
  | { pit: false }
  | {
      pit: true;
      compound: Compound;
      reason: "plan" | "wear" | "weather" | "neutralisation" | "rule";
      replan: boolean;
    };

/** What an AI pit wall decides as its car crosses the line. */
export function decidePit(i: PitDecisionInput): PitDecision {
  const remaining = i.totalLaps - i.lap;
  if (remaining <= 0) return { pit: false };

  // Weather: switch tyre once the conditions have called for it for long enough.
  const ideal = idealCompoundFor(i.wetness);
  const fittedType = isDry(i.compound) ? "dry" : i.compound;
  if (
    ideal !== fittedType &&
    i.weatherMismatchLaps > i.weatherReaction &&
    remaining > 1
  ) {
    const compound: Compound =
      ideal === "dry" ? (remaining > 25 ? "medium" : "soft") : ideal;
    return { pit: true, compound, reason: "weather", replan: true };
  }
  if (!isDry(i.compound)) return { pit: false };

  const nextPlanned = i.plan.stints[1]?.compound;

  if (i.wear >= MAX_PLANNED_WEAR + 4 && remaining > 2) {
    return {
      pit: true,
      compound: nextPlanned ?? (remaining > 20 ? "hard" : "medium"),
      reason: "wear",
      replan: !nextPlanned,
    };
  }

  // A cheap stop under the Safety Car if a stop was coming anyway.
  if (
    i.trackStatus !== "green" &&
    !i.stoppedUnderThisNeutralisation &&
    remaining > 4
  ) {
    const plannedStint = Math.max(
      1,
      i.plan.stints[0].endLap - (i.lap - i.tyreAge),
    );
    const stopComing =
      nextPlanned !== undefined && i.tyreAge >= plannedStint * 0.55;
    const worthIt = nextPlanned === undefined && i.wear > 45 && remaining > 10;
    const chance = i.trackStatus === "sc" ? 0.85 : 0.6;
    if ((stopComing || worthIt) && i.rng.chance(chance)) {
      return {
        pit: true,
        compound: nextPlanned ?? "medium",
        reason: "neutralisation",
        replan: true,
      };
    }
  }

  if (i.nextStopLap !== null && i.lap >= i.nextStopLap && nextPlanned) {
    return { pit: true, compound: nextPlanned, reason: "plan", replan: false };
  }

  // Never finish a dry race without using two compounds.
  const wetUsed = i.usedCompounds.some((c) => !isDry(c));
  const dryUsed = new Set(i.usedCompounds.filter(isDry));
  if (i.requireTwoCompounds && !wetUsed && dryUsed.size < 2 && remaining <= 2) {
    const other = (["medium", "soft", "hard"] as DryCompound[]).find(
      (c) => !dryUsed.has(c),
    )!;
    return { pit: true, compound: other, reason: "rule", replan: false };
  }

  return { pit: false };
}
