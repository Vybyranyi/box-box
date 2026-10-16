import type { Race, TimedEvent } from "@/engine";
import { estimatedWear, lapsLeftOnTyre } from "./pit-wall";

export type RaceAlert = {
  id: number;
  kind: "sc" | "vsc" | "rain" | "crossover" | "tyres" | "puncture";
  title: string;
  body: string;
  /** Player car indices the decision is about. */
  cars: number[];
};

/**
 * Moments that deserve a decision from the player. With auto-pause on, the race stops on these
 * and the alert offers quick actions.
 */
export function alertFor(
  race: Race,
  event: TimedEvent,
  playerTeamId: string | null,
): RaceAlert | null {
  if (!playerTeamId || race.phase !== "racing") return null;
  const running = race.cars
    .filter((c) => c.teamId === playerTeamId && c.status === "racing")
    .map((c) => c.index);
  if (running.length === 0) return null;
  const lapsLeft = race.laps - race.leaderLap;

  switch (event.type) {
    case "sc-deployed":
      return lapsLeft > 3
        ? {
            id: event.seq,
            kind: "sc",
            title: "Safety Car",
            body: "The field slows down: a pit stop now costs about half the usual time.",
            cars: running,
          }
        : null;
    case "vsc-deployed":
      return lapsLeft > 2
        ? {
            id: event.seq,
            kind: "vsc",
            title: "Virtual Safety Car",
            body: "Everyone is on the delta: a stop now saves several seconds.",
            cars: running,
          }
        : null;
    case "rain-start":
      return {
        id: event.seq,
        kind: "rain",
        title: "Rain is falling",
        body: "The track is getting wet. Inters become quicker once it's about 17% wet.",
        cars: running,
      };
    case "crossover":
      return {
        id: event.seq,
        kind: "crossover",
        title:
          event.to === "dry"
            ? "Track is drying"
            : event.to === "intermediate"
              ? "Inter conditions"
              : "Full wet conditions",
        body:
          event.to === "dry"
            ? "Slicks are now quicker than inters."
            : event.to === "intermediate"
              ? "Inters are now the quickest tyre."
              : "There's standing water: full wets are quickest.",
        cars: running,
      };
    case "tyre-warning": {
      const car = race.cars[event.car];
      if (
        car.teamId !== playerTeamId ||
        car.status !== "racing" ||
        lapsLeft <= 2
      )
        return null;
      const left = lapsLeftOnTyre(race, car);
      return {
        id: event.seq,
        kind: "tyres",
        title: `${car.code}: tyres fading`,
        body: `About ${Math.round(estimatedWear(race, car))}% worn${left !== null ? `, roughly ${left} laps before they fall off the cliff` : ""}.`,
        cars: [car.index],
      };
    }
    case "puncture": {
      const car = race.cars[event.car];
      if (car.teamId !== playerTeamId) return null;
      return {
        id: event.seq,
        kind: "puncture",
        title: `${car.code}: puncture!`,
        body: "He's crawling back to the pits. Choose the tyre to fit.",
        cars: [car.index],
      };
    }
    default:
      return null;
  }
}
