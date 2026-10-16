import { isDry, type CarState, type Race, type RaceCommand } from "@/engine";
import { msg, type Msg } from "./messages";
import { recommendedCompound } from "./pit-wall";

export type RadioRequestKind = "box" | "through" | "push" | "rain";

/** A driver asking the pit wall for something; the player answers Yes or No. */
export type RadioRequest = {
  id: string;
  kind: RadioRequestKind;
  driverId: string;
  code: string;
  /** What the driver says. */
  message: Msg;
  /** What happens on Yes. */
  yes: RaceCommand[];
  /** The engineer's answer either way. */
  yesReply: Msg;
  noReply: Msg;
  /** Race time when it was asked and when it lapses unanswered (s). */
  askedAt: number;
  expiresAt: number;
};

/** A driver asks for the same thing at most once in this many laps. */
const COOLDOWN_LAPS = 8;
/** Requests lapse after this many laps without an answer. */
const EXPIRES_AFTER_LAPS = 1.5;
/** Pace advantage (s/lap) over a teammate ahead that makes a driver ask to be let through. */
const THROUGH_PACE = 0.25;
/** Pass chance with Push that makes a driver ask to push. */
const PUSH_CHANCE = 0.15;

/**
 * Raises driver requests from the race state and keeps track of the open ones. The state is
 * plain data so the same race and answers always produce the same requests.
 */
export class RadioRequests {
  private open: RadioRequest[] = [];
  /** `${driverId}:${kind}` → lap it was last asked. */
  private lastAsked = new Map<string, number>();

  get active(): readonly RadioRequest[] {
    return this.open;
  }

  /** Drop lapsed requests and raise new ones; returns the new ones. */
  update(race: Race, teamId: string): RadioRequest[] {
    this.open = this.open.filter((r) => {
      const car = race.carByDriver(r.driverId);
      return race.time < r.expiresAt && car?.status === "racing";
    });
    if (race.phase !== "racing" || race.trackStatus !== "green") return [];

    const raised: RadioRequest[] = [];
    for (const car of race.cars) {
      if (car.teamId !== teamId || car.status !== "racing" || car.lap < 2)
        continue;
      if (this.open.some((r) => r.driverId === car.driverId)) continue;
      const request = this.ask(race, car);
      if (!request) continue;
      this.lastAsked.set(`${car.driverId}:${request.kind}`, car.lap);
      this.open.push(request);
      raised.push(request);
    }
    return raised;
  }

  /** Answer a request; returns it (with its commands and reply) or null if it has lapsed. */
  answer(id: string): RadioRequest | null {
    const request = this.open.find((r) => r.id === id) ?? null;
    this.open = this.open.filter((r) => r.id !== id);
    return request;
  }

  private ask(race: Race, car: CarState): RadioRequest | null {
    const can = (kind: RadioRequestKind) => {
      const last = this.lastAsked.get(`${car.driverId}:${kind}`);
      return last === undefined || car.lap - last >= COOLDOWN_LAPS;
    };
    const remaining = race.laps - car.lap;
    const request = (
      kind: RadioRequestKind,
      message: Msg,
      yes: RaceCommand[],
      yesReply: Msg,
      noReply: Msg,
    ): RadioRequest => {
      const lapTime = car.lastLapTime ?? race.expectedLap(car);
      return {
        id: `${car.driverId}:${kind}:${car.lap}`,
        kind,
        driverId: car.driverId,
        code: car.code,
        message,
        yes,
        yesReply,
        noReply,
        askedAt: race.time,
        expiresAt: race.time + lapTime * EXPIRES_AFTER_LAPS,
      };
    };

    // Rain on slicks, just before the crossover: a gamble the driver wants to take.
    const wetness = race.weather.wetness;
    if (
      can("rain") &&
      isDry(car.tyre.compound) &&
      !car.pitRequest &&
      race.weather.rain > 0.05 &&
      wetness >= 0.1 &&
      wetness < 0.17 &&
      remaining > 3
    )
      return request(
        "rain",
        msg("radioRequest.rain"),
        [{ type: "pit", driverId: car.driverId, compound: "intermediate" }],
        msg("radioRequest.yes.rain"),
        msg("radioRequest.no.rain"),
      );

    // Worn-out tyres.
    if (
      can("box") &&
      isDry(car.tyre.compound) &&
      !car.pitRequest &&
      car.tyre.wear >= 76 &&
      remaining > 3
    )
      return request(
        "box",
        msg("radioRequest.box"),
        [
          {
            type: "pit",
            driverId: car.driverId,
            compound: recommendedCompound(race, car),
          },
        ],
        msg("radioRequest.yes.box"),
        msg("radioRequest.no.box"),
      );

    const battle = race.battle(car);
    const ahead = battle && race.cars[battle.ahead];

    // Stuck behind a slower teammate.
    if (
      can("through") &&
      battle &&
      ahead &&
      ahead.teamId === car.teamId &&
      battle.gap < 1 &&
      battle.paceDelta >= THROUGH_PACE &&
      race.teamOrders[car.teamId] !== "swap"
    )
      return request(
        "through",
        msg("radioRequest.through", { car: ahead.code }),
        [{ type: "team-order", teamId: car.teamId, order: "swap" }],
        msg("radioRequest.yes.through", { car: ahead.code }),
        msg("radioRequest.no.through"),
      );

    // A real chance to pass a rival if allowed to push.
    if (
      can("push") &&
      car.paceMode !== "push" &&
      battle &&
      ahead &&
      ahead.teamId !== car.teamId &&
      battle.gap < 1.2 &&
      battle.passChance < PUSH_CHANCE &&
      (race.battle(car, { paceMode: "push" })?.passChance ?? 0) >= PUSH_CHANCE
    )
      return request(
        "push",
        msg("radioRequest.push", { car: ahead.code }),
        [{ type: "pace", driverId: car.driverId, mode: "push" }],
        msg("radioRequest.yes.push"),
        msg("radioRequest.no.push"),
      );

    // Under pressure late in the race.
    const behind = race.cars[race.order[car.position]];
    const defence = behind?.status === "racing" ? race.battle(behind) : null;
    if (
      can("push") &&
      car.paceMode !== "push" &&
      remaining <= 10 &&
      defence &&
      defence.ahead === car.index &&
      behind.teamId !== car.teamId &&
      defence.gap < 0.8 &&
      defence.passChance >= 0.1
    )
      return request(
        "push",
        msg("radioRequest.pushDefend", { car: behind.code }),
        [{ type: "pace", driverId: car.driverId, mode: "push" }],
        msg("radioRequest.yes.push"),
        msg("radioRequest.no.push"),
      );

    return null;
  }
}
