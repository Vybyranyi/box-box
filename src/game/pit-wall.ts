import {
  idealCompoundFor,
  isDry,
  type CarState,
  type Compound,
  type Race,
} from "@/engine";
import { msg, tyreName, tyresPlural, type Msg } from "./messages";

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
export function planSummary(race: Race, car: CarState): Msg {
  if (car.status === "retired") return msg("advice.retired");
  if (car.status === "finished") return msg("advice.finished");
  const ideal = idealCompoundFor(race.weather.wetness);
  const fitted = isDry(car.tyre.compound) ? "dry" : car.tyre.compound;
  if (ideal !== fitted) {
    return ideal === "dry"
      ? msg("advice.dryEnough")
      : msg("advice.callFor", { tyre: tyresPlural(ideal) });
  }
  if (!isDry(car.tyre.compound)) return msg("advice.rightTyres");
  const plan = race.suggestStrategy(car);
  const next = plan.stints[1];
  if (!next)
    return msg(
      needsSecondCompound(race, car)
        ? "advice.mustSecond"
        : "advice.noMoreStops",
    );
  const lap = plan.stints[0].endLap;
  const then = plan.stints[2];
  return then
    ? msg("advice.planThen", {
        lap,
        next: tyresPlural(next.compound),
        then: tyresPlural(then.compound),
      })
    : msg("advice.plan", { lap, next: tyresPlural(next.compound) });
}

/** Starting tyre advice before the race. */
export function suggestedStart(
  race: Race,
  car: CarState,
): { compound: Compound; summary: Msg } {
  const ideal = idealCompoundFor(race.weather.wetness);
  if (ideal !== "dry")
    return {
      compound: ideal,
      summary: msg("advice.wetStart", { tyre: tyresPlural(ideal) }),
    };
  const [a, b, c] = race.suggestStrategy(car, true).stints;
  const summary = c
    ? msg("advice.start2", {
        a: tyreName(a.compound),
        al: a.endLap,
        b: tyreName(b.compound),
        bl: b.endLap,
        c: tyreName(c.compound),
      })
    : b
      ? msg("advice.start1", {
          a: tyreName(a.compound),
          al: a.endLap,
          b: tyreName(b.compound),
        })
      : msg("advice.start0", { a: tyreName(a.compound) });
  return { compound: a.compound, summary };
}
