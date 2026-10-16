import type { Race, TimedEvent } from "@/engine";
import { msg, type Msg } from "./messages";
import { estimatedWear, lapsLeftOnTyre } from "./pit-wall";

export type RaceAlert = {
  id: number;
  kind: "sc" | "vsc" | "rain" | "crossover" | "tyres" | "puncture";
  title: Msg;
  body: Msg;
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
  const alert = (
    kind: RaceAlert["kind"],
    key: string,
    cars = running,
    values?: Msg["values"],
    bodyKey = "body",
  ) => ({
    id: event.seq,
    kind,
    title: msg(`alert.${key}.title`, values),
    body: msg(`alert.${key}.${bodyKey}`, values),
    cars,
  });

  switch (event.type) {
    case "sc-deployed":
      return lapsLeft > 3 ? alert("sc", "sc") : null;
    case "vsc-deployed":
      return lapsLeft > 2 ? alert("vsc", "vsc") : null;
    case "rain-start":
      return alert("rain", "rain");
    case "crossover":
      return alert("crossover", `crossover.${event.to}`);
    case "tyre-warning": {
      const car = race.cars[event.car];
      if (
        car.teamId !== playerTeamId ||
        car.status !== "racing" ||
        lapsLeft <= 2
      )
        return null;
      const left = lapsLeftOnTyre(race, car);
      return alert(
        "tyres",
        "tyres",
        [car.index],
        {
          car: car.code,
          wear: Math.round(estimatedWear(race, car)),
          laps: left ?? 0,
        },
        left === null ? "bodyNoLaps" : "body",
      );
    }
    case "puncture": {
      const car = race.cars[event.car];
      if (car.teamId !== playerTeamId) return null;
      return alert("puncture", "puncture", [car.index], { car: car.code });
    }
    default:
      return null;
  }
}
