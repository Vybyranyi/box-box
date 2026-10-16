import type { CarState, Race, TimedEvent } from "@/engine";
import { ENGINEER, type FeedItem } from "./event-text";
import { msg, type Msg } from "./messages";
import { lapsLeftOnTyre } from "./pit-wall";

/** Number of variants per radio line in messages/*.json (radio.<key>.0 … n-1). */
const VARIANTS = {
  tyreWarning: 4,
  puncture: 2,
  goodStop: 3,
  slowStop: 2,
  overtakeMade: 4,
  overtaken: 3,
  crash: 3,
  mechanical: 3,
  sc: 2,
  green: 2,
} as const;

/** Pick a variant deterministically, so replays read the same. */
const variant = (
  key: keyof typeof VARIANTS,
  seq: number,
  values?: Msg["values"],
) => msg(`radio.${key}.${seq % VARIANTS[key]}`, values);

const TURNS = [1, 3, 4, 7, 9, 11, 14];

function radio(
  race: Race,
  event: TimedEvent,
  from: CarState | "engineer",
  message: Msg,
): FeedItem {
  return {
    id: event.seq * 2 + 1,
    lap: Math.min(event.lap + 1, race.laps),
    message,
    tone: "info",
    kind: "radio",
    from: from === "engineer" ? ENGINEER : from.code,
    color: from === "engineer" ? undefined : race.team(from).color,
  };
}

/**
 * Team radio for the player's cars: drivers reacting to what happens to them, and the engineer
 * calling neutralisations. Returns null for events that don't concern the player.
 */
export function radioFor(
  race: Race,
  event: TimedEvent,
  playerTeamId: string | null,
): FeedItem | null {
  if (!playerTeamId) return null;
  const seq = event.seq;
  const own = (index: number) => {
    const car = race.cars[index];
    return car.teamId === playerTeamId ? car : null;
  };
  const anyRunning = race.cars.some(
    (c) =>
      c.teamId === playerTeamId &&
      (c.status === "racing" || c.status === "pit"),
  );

  switch (event.type) {
    case "tyre-warning": {
      const car = own(event.car);
      if (!car) return null;
      const left = lapsLeftOnTyre(race, car);
      // Variant 2 quotes the laps left; fall back to variant 0 when there's no estimate.
      const v = seq % VARIANTS.tyreWarning;
      const message =
        v === 2 && left === null
          ? msg("radio.tyreWarning.0")
          : variant("tyreWarning", seq, { laps: left ?? 0 });
      return radio(race, event, car, message);
    }
    case "puncture": {
      const car = own(event.car);
      return car ? radio(race, event, car, variant("puncture", seq)) : null;
    }
    case "pit-exit": {
      const car = own(event.car);
      if (!car) return null;
      const seconds = event.stationarySeconds.toFixed(1);
      return radio(
        race,
        event,
        "engineer",
        event.slow
          ? variant("slowStop", seq, { car: car.code, seconds })
          : variant("goodStop", seq, { seconds }),
      );
    }
    case "overtake": {
      const mine = own(event.car);
      const victim = own(event.on);
      if (mine && victim) return null;
      if (mine) return radio(race, event, mine, variant("overtakeMade", seq));
      if (victim) return radio(race, event, victim, variant("overtaken", seq));
      return null;
    }
    case "crash": {
      const car = own(event.car);
      return car ? radio(race, event, car, variant("crash", seq)) : null;
    }
    case "mechanical": {
      const car = own(event.car);
      return car ? radio(race, event, car, variant("mechanical", seq)) : null;
    }
    case "fastest-lap": {
      const car = own(event.car);
      return car && event.lap > 1
        ? radio(
            race,
            event,
            "engineer",
            msg("radio.fastestLap", { car: car.code }),
          )
        : null;
    }
    case "sc-deployed":
      return anyRunning
        ? radio(race, event, "engineer", variant("sc", seq))
        : null;
    case "vsc-deployed":
      return anyRunning
        ? radio(race, event, "engineer", msg("radio.vsc"))
        : null;
    case "green":
      return anyRunning
        ? radio(race, event, "engineer", variant("green", seq))
        : null;
    case "rain-start": {
      const car = race.cars.find(
        (c) => c.teamId === playerTeamId && c.status === "racing",
      );
      return car
        ? radio(
            race,
            event,
            car,
            msg("radio.rain", { turn: TURNS[seq % TURNS.length] }),
          )
        : null;
    }
    case "crossover":
      return anyRunning
        ? radio(race, event, "engineer", msg(`radio.crossover.${event.to}`))
        : null;
    case "finished": {
      const car = own(event.car);
      if (!car) return null;
      const p = event.position;
      const key =
        p === 1 ? "win" : p <= 3 ? "podium" : p <= 10 ? "points" : "none";
      return radio(
        race,
        event,
        car,
        msg(`radio.finish.${key}`, { position: p }),
      );
    }
    default:
      return null;
  }
}
