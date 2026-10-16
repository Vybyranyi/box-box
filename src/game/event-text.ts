import type { Race, TimedEvent } from "@/engine";
import { formatLapTime } from "@/lib/format";

const COMPOUND_NAME = {
  soft: "softs",
  medium: "mediums",
  hard: "hards",
  intermediate: "inters",
  wet: "full wets",
} as const;

export type FeedItem = {
  id: number;
  lap: number;
  text: string;
  tone: "info" | "warning" | "danger" | "good";
};

/** Human-readable line for the race feed, or null for events not worth showing. */
export function describeEvent(race: Race, event: TimedEvent): FeedItem | null {
  const item = describe(race, event);
  return item ? { ...item, id: event.seq } : null;
}

function describe(race: Race, event: TimedEvent): Omit<FeedItem, "id"> | null {
  const code = (i: number) => race.cars[i].code;
  // event.lap counts completed laps; show the lap being raced.
  const lap = Math.min(event.lap + 1, race.laps);
  switch (event.type) {
    case "start":
      return { lap, text: "Lights out and away we go!", tone: "good" };
    case "overtake":
      return {
        lap,
        text: `${code(event.car)} passes ${code(event.on)}`,
        tone: "info",
      };
    case "pit-entry":
      return {
        lap,
        text: `${code(event.car)} pits for ${COMPOUND_NAME[event.compound]}`,
        tone: "info",
      };
    case "pit-exit":
      return event.slow
        ? {
            lap,
            text: `Slow stop for ${code(event.car)}: ${event.stationarySeconds.toFixed(1)} s`,
            tone: "warning",
          }
        : null;
    case "sc-deployed":
      return { lap, text: "Safety Car deployed", tone: "warning" };
    case "sc-ending":
      return { lap, text: "Safety Car in this lap", tone: "warning" };
    case "vsc-deployed":
      return { lap, text: "Virtual Safety Car", tone: "warning" };
    case "vsc-ending":
      return { lap, text: "VSC ending", tone: "warning" };
    case "green":
      return { lap, text: "Green flag, racing resumes", tone: "good" };
    case "rain-start":
      return { lap, text: "Rain is falling", tone: "warning" };
    case "rain-stop":
      return { lap, text: "Rain has stopped", tone: "info" };
    case "crash":
      return { lap, text: `${code(event.car)} crashes out!`, tone: "danger" };
    case "mechanical":
      return {
        lap,
        text: `${code(event.car)} retires with a problem`,
        tone: "danger",
      };
    case "puncture":
      return { lap, text: `Puncture for ${code(event.car)}!`, tone: "danger" };
    case "fastest-lap":
      return lap > 1
        ? {
            lap,
            text: `Fastest lap: ${code(event.car)} ${formatLapTime(event.time)}`,
            tone: "good",
          }
        : null;
    case "chequered-flag":
      return { lap, text: "Chequered flag!", tone: "good" };
    case "finished":
      return event.position <= 3
        ? {
            lap,
            text: `${code(event.car)} finishes P${event.position}`,
            tone: "good",
          }
        : null;
    case "disqualified":
      return {
        lap,
        text: `${code(event.car)} disqualified: ${event.reason}`,
        tone: "danger",
      };
    case "team-order":
      return event.order === "free"
        ? null
        : { lap, text: `Team order: ${event.order}`, tone: "info" };
    default:
      return null;
  }
}
