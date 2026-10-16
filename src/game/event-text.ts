import type { Race, TimedEvent } from "@/engine";
import { formatLapTime } from "@/lib/format";
import { msg, tyresPlural, type Msg } from "./messages";

/** Marks a radio message from the race engineer rather than a driver. */
export const ENGINEER = "@engineer";

export type FeedItem = {
  id: number;
  lap: number;
  message: Msg;
  tone: "info" | "warning" | "danger" | "good";
  /** Race control announcements vs team radio. */
  kind: "control" | "radio";
  /** Radio speaker: a driver code or ENGINEER. */
  from?: string;
  /** Speaker's team colour. */
  color?: string;
};

/** Race control line for an event, or null for events not worth showing. */
export function describeEvent(race: Race, event: TimedEvent): FeedItem | null {
  const item = describe(race, event);
  return item ? { ...item, id: event.seq * 2, kind: "control" } : null;
}

function describe(
  race: Race,
  event: TimedEvent,
): Omit<FeedItem, "id" | "kind"> | null {
  const code = (i: number) => race.cars[i].code;
  // event.lap counts completed laps; show the lap being raced.
  const lap = Math.min(event.lap + 1, race.laps);
  const line = (
    key: string,
    tone: FeedItem["tone"],
    values?: Msg["values"],
  ) => ({
    lap,
    tone,
    message: msg(`control.${key}`, values),
  });

  switch (event.type) {
    case "start":
      return line("start", "good");
    case "overtake":
      return line("overtake", "info", {
        car: code(event.car),
        on: code(event.on),
      });
    case "pit-entry":
      return line("pitEntry", "info", {
        car: code(event.car),
        compound: tyresPlural(event.compound),
      });
    case "pit-exit":
      return event.slow
        ? line("slowStop", "warning", {
            car: code(event.car),
            seconds: event.stationarySeconds.toFixed(1),
          })
        : null;
    case "sc-deployed":
      return line("scDeployed", "warning");
    case "sc-ending":
      return line("scEnding", "warning");
    case "vsc-deployed":
      return line("vscDeployed", "warning");
    case "vsc-ending":
      return line("vscEnding", "warning");
    case "green":
      return line("green", "good");
    case "rain-start":
      return line("rainStart", "warning");
    case "rain-stop":
      return line("rainStop", "info");
    case "crash":
      return line("crash", "danger", { car: code(event.car) });
    case "mechanical":
      return line("mechanical", "danger", { car: code(event.car) });
    case "puncture":
      return line("puncture", "danger", { car: code(event.car) });
    case "fastest-lap":
      return lap > 1
        ? line("fastestLap", "good", {
            car: code(event.car),
            time: formatLapTime(event.lapTime),
          })
        : null;
    case "chequered-flag":
      return line("chequered", "good");
    case "finished":
      return event.position <= 3
        ? line("finished", "good", {
            car: code(event.car),
            position: event.position,
          })
        : null;
    case "disqualified":
      return line("disqualified", "danger", { car: code(event.car) });
    case "boost": {
      // Only the fights that involve the player's cars, or the feed would flood.
      if (!race.cars[event.car].isPlayer && !race.cars[event.target].isPlayer)
        return null;
      return line(
        event.kind === "attack" ? "boostAttack" : "boostDefend",
        "info",
        { car: code(event.car), target: code(event.target) },
      );
    }
    case "team-order":
      return event.order === "free"
        ? null
        : line(
            event.order === "swap" ? "teamOrderSwap" : "teamOrderHold",
            "info",
          );
    default:
      return null;
  }
}
