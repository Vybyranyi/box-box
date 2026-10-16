import { isDry, type CarState, type DryCompound, type Race } from "@/engine";
import { msg, tyresPlural, type Msg } from "./messages";
import { recommendedCompound } from "./pit-wall";

/** A situational hint from the pit wall, with an optional suggestion of what to do about it. */
export type Insight = {
  tone: "good" | "warn" | "info";
  message: Msg;
  tip?: Msg;
};

/** Battles closer than this (s) are shown; the car can attack from about 0.3 s. */
const BATTLE_GAP = 1.2;
/** Below this pass chance per lap the car is effectively stuck. */
const STUCK_CHANCE = 0.1;
/** Pass chance per lap that makes switching to Push worth the extra tyre wear. */
const PUSH_WORTH_IT = 0.15;
/** Undercut checks only look at rivals within this gap (s). */
const UNDERCUT_RANGE = 3.5;
/** Margin (s) the undercut must win by to be worth calling. */
const UNDERCUT_MARGIN = 0.2;
/** Rejoining closer than this behind another car (s) puts you in its dirty air. */
const TRAFFIC_GAP = 1;

const seconds = (s: number) => Math.abs(s).toFixed(1);
const percent = (p: number) => Math.round(p * 100);

/** Whether the best plan says to box at the end of the lap in progress. */
export function boxNow(race: Race, car: CarState): boolean {
  if (car.status !== "racing" || car.pitRequest || !isDry(car.tyre.compound))
    return false;
  const plan = race.suggestStrategy(car);
  return plan.stints.length > 1 && plan.stints[0].endLap <= car.lap + 1;
}

/** Where the car would come out if it boxed this lap. */
export function pitWindow(race: Race, car: CarState): Insight | null {
  if (car.status !== "racing" || car.lap < 1 || race.laps - car.lap < 2)
    return null;
  const rejoin = race.pitRejoin(car);
  if (!rejoin) return null;
  const { position, ahead } = rejoin;
  if (!ahead) return { tone: "good", message: msg("insight.rejoinLead") };
  const values = {
    position,
    car: race.cars[ahead.car].code,
    gap: seconds(ahead.gap),
  };
  return ahead.gap < TRAFFIC_GAP
    ? { tone: "warn", message: msg("insight.rejoinTraffic", values) }
    : { tone: "info", message: msg("insight.rejoin", values) };
}

/**
 * Time `attacker` gains on `defender` by stopping one lap earlier: its out-lap on new tyres
 * against the defender's lap on old ones, then the defender's own out-lap.
 */
export function undercutGain(
  race: Race,
  attacker: CarState,
  defender: CarState,
  compound: DryCompound,
): number {
  const fresh = { compound, wear: 0 };
  const attackerOutLap = race.expectedLap(attacker, { ...fresh, outLap: true });
  const attackerNextLap = race.expectedLap(attacker, {
    ...fresh,
    outLap: false,
  });
  const defenderOldTyres = race.expectedLap(defender, { outLap: false });
  const defenderOutLap = race.expectedLap(defender, { ...fresh, outLap: true });
  return defenderOldTyres - attackerOutLap + (defenderOutLap - attackerNextLap);
}

function neighbour(race: Race, car: CarState, offset: -1 | 1) {
  const other = race.cars[race.order[car.position - 1 + offset]];
  return other && other.status === "racing" ? other : null;
}

/** Whether a stop is coming up soon anyway, so an early one is a real option. */
function stopDue(race: Race, car: CarState): boolean {
  const plan = race.suggestStrategy(car);
  return (
    (plan.stints.length > 1 && plan.stints[0].endLap - car.lap <= 8) ||
    car.tyre.wear >= 50
  );
}

/** Undercut chances on the car ahead, or the threat of one from the car behind. */
export function undercutInsight(race: Race, car: CarState): Insight | null {
  if (
    car.status !== "racing" ||
    race.trackStatus !== "green" ||
    !isDry(car.tyre.compound) ||
    race.weather.wetness > 0.1 ||
    race.laps - car.lap < 6 ||
    car.lap < 2
  )
    return null;
  const compound = recommendedCompound(race, car);
  if (!isDry(compound)) return null;

  const ahead = neighbour(race, car, -1);
  if (
    ahead &&
    ahead.teamId !== car.teamId &&
    isDry(ahead.tyre.compound) &&
    ahead.tyre.wear >= 35 &&
    car.interval !== null &&
    car.interval <= UNDERCUT_RANGE &&
    stopDue(race, car)
  ) {
    const gain = undercutGain(race, car, ahead, compound);
    if (gain > car.interval + UNDERCUT_MARGIN) {
      const rejoin = race.pitRejoin(car);
      const traffic =
        rejoin?.ahead && rejoin.ahead.gap < TRAFFIC_GAP
          ? race.cars[rejoin.ahead.car]
          : null;
      return traffic
        ? {
            tone: "warn",
            message: msg("insight.undercutTraffic", {
              car: ahead.code,
              other: traffic.code,
            }),
          }
        : {
            tone: "good",
            message: msg("insight.undercutOn", {
              car: ahead.code,
              gain: seconds(gain),
            }),
            tip: msg("insight.tipBoxFor", { tyre: tyresPlural(compound) }),
          };
    }
  }

  const behind = neighbour(race, car, 1);
  if (
    behind &&
    behind.teamId !== car.teamId &&
    behind.interval !== null &&
    behind.interval <= UNDERCUT_RANGE &&
    isDry(behind.tyre.compound) &&
    behind.tyre.wear >= 35 &&
    car.tyre.wear >= 35
  ) {
    const gain = undercutGain(race, behind, car, compound);
    if (gain > behind.interval + UNDERCUT_MARGIN)
      return {
        tone: "warn",
        message: msg("insight.undercutThreat", {
          car: behind.code,
          gain: seconds(gain),
        }),
        tip: stopDue(race, car) ? msg("insight.tipCover") : undefined,
      };
  }
  return null;
}

/** The fight with the car ahead (or behind): pace, dirty air and the chance of a pass. */
export function battleInsight(race: Race, car: CarState): Insight | null {
  const battle = race.battle(car);
  if (battle && battle.gap <= BATTLE_GAP) {
    const ahead = race.cars[battle.ahead];
    const chance = percent(battle.passChance);
    if (battle.passChance >= STUCK_CHANCE)
      return {
        tone: "good",
        message: msg("insight.attacking", {
          car: ahead.code,
          delta: seconds(battle.paceDelta),
          chance,
        }),
      };
    const teammateHold =
      ahead.teamId === car.teamId && race.teamOrders[car.teamId] === "hold";
    // Only suggest pushing when it makes a pass realistic: pushing for many laps while stuck
    // just burns the tyres.
    const withPush =
      car.paceMode === "push" ? null : race.battle(car, "push")?.passChance;
    const tip = teammateHold
      ? msg("insight.tipHold")
      : withPush && withPush >= PUSH_WORTH_IT
        ? msg("insight.tipPush", { chance: percent(withPush) })
        : undercutInsight(race, car)?.tone === "good"
          ? msg("insight.tipUndercut")
          : msg("insight.tipWait");
    return {
      tone: "warn",
      message: msg(
        battle.paceDelta > 0 ? "insight.stuckFaster" : "insight.stuckSlower",
        {
          car: ahead.code,
          dirty: seconds(battle.dirtyAir),
          delta: seconds(battle.paceDelta),
          chance,
        },
      ),
      tip,
    };
  }

  const behind = neighbour(race, car, 1);
  const defence = behind && race.battle(behind);
  if (
    defence &&
    defence.ahead === car.index &&
    defence.gap <= BATTLE_GAP &&
    defence.passChance >= STUCK_CHANCE
  )
    return {
      tone: "warn",
      message: msg("insight.defending", {
        car: behind.code,
        chance: percent(defence.passChance),
      }),
      // Late in the race the extra tyre wear from pushing no longer matters.
      tip:
        car.paceMode !== "push" && race.laps - car.lap <= 10
          ? msg("insight.tipDefend")
          : undefined,
    };
  return null;
}

/** Hints for a car card, most urgent first. */
export function carInsights(race: Race, car: CarState): Insight[] {
  const battle = battleInsight(race, car);
  const undercut = undercutInsight(race, car);
  return [battle, undercut].filter((x) => x !== null);
}

/**
 * The engineer's "box this lap" call for each of the player's cars whose plan says so, once per
 * stint (`said` remembers which calls were already made).
 */
export function boxCalls(race: Race, teamId: string, said: Set<string>): Msg[] {
  const calls: Msg[] = [];
  for (const car of race.cars) {
    if (car.teamId !== teamId || !boxNow(race, car)) continue;
    const key = `${car.driverId}:${car.stints.length}`;
    if (said.has(key)) continue;
    said.add(key);
    calls.push(
      msg("radio.boxCall", {
        car: car.code,
        tyre: tyresPlural(recommendedCompound(race, car)),
      }),
    );
  }
  return calls;
}
