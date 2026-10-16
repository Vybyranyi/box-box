import {
  idealCompoundFor,
  isDry,
  type CarState,
  type Compound,
  type Race,
} from "@/engine";

/** Wear at which we consider a tyre finished, for "laps left" estimates. */
export const CLIFF_WEAR = 80;
/** Relative error of the team's wear estimate (real teams can't measure it exactly). */
const WEAR_ESTIMATE_ERROR = 0.08;

/** Small deterministic hash → [-1, 1], so the estimate error is stable for a stint. */
function noise(...parts: number[]): number {
  let h = 2166136261;
  for (const p of parts) h = Math.imul(h ^ (p | 0), 16777619);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

/** What the pit wall believes the tyre wear is, in %. */
export function estimatedWear(race: Race, car: CarState): number {
  const error =
    noise(race.config.seed, car.index, car.stints.length) * WEAR_ESTIMATE_ERROR;
  return Math.min(100, Math.max(0, car.tyre.wear * (1 + error)));
}

/** Estimated laps until the tyre reaches the cliff, at the current pace. */
export function lapsLeftOnTyre(race: Race, car: CarState): number | null {
  if (car.status === "retired" || car.status === "finished") return null;
  const rate = race.wearRate(car);
  if (rate <= 0) return null;
  return Math.max(
    0,
    Math.floor((CLIFF_WEAR - estimatedWear(race, car)) / rate),
  );
}

/** Whether the car still has to use a second dry compound to avoid disqualification. */
export function needsSecondCompound(race: Race, car: CarState): boolean {
  if (!race.requireTwoCompounds) return false;
  if (car.usedCompounds.some((c) => !isDry(c))) return false;
  return new Set(car.usedCompounds.filter(isDry)).size < 2;
}

/** The tyre to fit at the next stop: what the conditions need, or the next stint of the best plan. */
export function recommendedCompound(race: Race, car: CarState): Compound {
  const ideal = idealCompoundFor(race.weather.wetness);
  if (ideal !== "dry") return ideal;
  const remaining = race.laps - car.lap;
  const plan = race.suggestStrategy(car);
  const next =
    plan.stints[1]?.compound ??
    (remaining > 22 ? "hard" : remaining > 12 ? "medium" : "soft");
  if (needsSecondCompound(race, car) && next === car.tyre.compound) {
    return car.tyre.compound === "hard" ? "medium" : "hard";
  }
  return next;
}

/** One-line advice from the strategy desk. */
export function planSummary(race: Race, car: CarState): string {
  if (car.status === "retired") return "Retired";
  if (car.status === "finished") return "Finished";
  const ideal = idealCompoundFor(race.weather.wetness);
  const fitted = isDry(car.tyre.compound) ? "dry" : car.tyre.compound;
  if (ideal !== fitted) {
    return ideal === "dry"
      ? "Track is dry enough for slicks"
      : `Conditions call for ${ideal === "wet" ? "full wets" : "inters"}`;
  }
  if (!isDry(car.tyre.compound)) return "Right tyres for the conditions";
  const plan = race.suggestStrategy(car);
  const next = plan.stints[1];
  if (!next)
    return needsSecondCompound(race, car)
      ? "Must still use a second compound"
      : "Plan: no more stops";
  const stopLap = plan.stints[0].endLap;
  return `Plan: box ~L${stopLap} for ${next.compound}s${plan.stints.length > 2 ? `, then ${plan.stints[2].compound}s` : ""}`;
}

/** Starting tyre advice before the race. */
export function suggestedStart(
  race: Race,
  car: CarState,
): { compound: Compound; summary: string } {
  const ideal = idealCompoundFor(race.weather.wetness);
  if (ideal !== "dry")
    return {
      compound: ideal,
      summary: `Wet start: ${ideal === "wet" ? "full wets" : "inters"}`,
    };
  const plan = race.suggestStrategy(car, true);
  const name = (c: string) => c[0].toUpperCase() + c.slice(1);
  const stints = plan.stints.map((s, i) =>
    i < plan.stints.length - 1
      ? `${name(s.compound)} to L${s.endLap}`
      : name(s.compound),
  );
  return {
    compound: plan.stints[0].compound,
    summary: `${plan.stints.length - 1}-stop: ${stints.join(", then ")}`,
  };
}
