import type { QualiEvent, QualiSession } from "@/engine";
import { formatLapTime } from "@/lib/format";
import { msg, type Msg } from "./messages";

export type QualiFeedItem = {
  id: number;
  phase: number;
  /** Seconds left in the part when it happened. */
  remaining: number;
  message: Msg;
  tone: "good" | "bad" | "info";
  /** Said by the race engineer on the radio (the player's own cars). */
  radio: boolean;
};

/**
 * What the feed (and the engineer) says about a qualifying event. Laps by the player's cars
 * always get a line; rivals only when they go top or have a lap deleted at the front.
 */
export function qualiFeed(
  session: QualiSession,
  event: QualiEvent,
  playerTeamId: string | null,
): QualiFeedItem | null {
  const base = {
    id: event.seq,
    phase: event.phase,
    remaining: Math.max(0, session.duration - event.clock),
  };
  switch (event.type) {
    case "lap": {
      const car = session.cars[event.car];
      const own = car.teamId === playerTeamId;
      const { lap, position } = event;
      if (lap.deleted)
        return own
          ? {
              ...base,
              message: msg("quali.feed.deleted", { car: car.code }),
              tone: "bad",
              radio: true,
            }
          : null;
      const time = formatLapTime(lap.time);
      const improved = lap.time === car.best[event.phase];
      if (!own)
        return position === 1 && improved
          ? {
              ...base,
              message: msg("quali.feed.top", { car: car.code, time }),
              tone: "info",
              radio: false,
            }
          : null;
      const why = lap.mistake ? "mistake" : lap.traffic ? "traffic" : null;
      return {
        ...base,
        message: msg(
          improved
            ? why
              ? `quali.feed.bestDespite.${why}`
              : "quali.feed.best"
            : why
              ? `quali.feed.slower.${why}`
              : "quali.feed.slower.plain",
          { car: car.code, time, position: position ?? "-" },
        ),
        tone: improved && !why ? "good" : why ? "bad" : "info",
        radio: true,
      };
    }
    case "flag":
      return {
        ...base,
        message: msg("quali.feed.flag", { phase: event.phase + 1 }),
        tone: "info",
        radio: false,
      };
    case "phase-end": {
      const out = event.eliminated.map((i) => session.cars[i]);
      const ownOut = out.filter((c) => c.teamId === playerTeamId);
      if (event.phase === 2)
        return {
          ...base,
          message: msg("quali.feed.pole", {
            car: session.standings(2)[0].code,
          }),
          tone: "good",
          radio: false,
        };
      return {
        ...base,
        message: msg(ownOut.length ? "quali.feed.outOwn" : "quali.feed.out", {
          phase: event.phase + 1,
          cars: out.map((c) => c.code).join(", "),
        }),
        tone: ownOut.length ? "bad" : "info",
        radio: false,
      };
    }
    default:
      return null;
  }
}
