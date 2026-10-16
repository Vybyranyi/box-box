import type { Compound, Race } from "@/engine";

export type TowerRow = {
  index: number;
  driverId: string;
  position: number;
  code: string;
  lastName: string;
  teamColor: string;
  teamId: string;
  isPlayer: boolean;
  /** Gap to the leader. */
  gap: TowerGap;
  /** Interval to the car ahead. */
  interval: TowerGap;
  compound: Compound;
  tyreAge: number;
  wear: number;
  stops: number;
  state: "racing" | "pit" | "out" | "retired" | "finished";
  /** Places gained since the start (negative = lost). */
  gained: number;
  lastLap: number | null;
  bestLap: number | null;
  fastestLap: boolean;
  /** Overtake Mode in use. */
  boost: "attack" | "defend" | null;
};

/** What the gap column shows; the UI formats and translates it. */
export type TowerGap =
  | { type: "time"; seconds: number }
  | { type: "laps"; laps: number }
  | { type: "label"; label: "leader" | "winner" | "pit" | "dnf" | "none" };

/** Snapshot of the classification for the timing tower. */
export function buildTower(race: Race): TowerRow[] {
  return race.order.map((index) => {
    const car = race.cars[index];
    const driver = race.driver(car);
    const team = race.team(car);
    const state: TowerRow["state"] =
      car.status === "retired"
        ? "retired"
        : car.status === "finished"
          ? "finished"
          : car.status === "pit"
            ? "pit"
            : car.outLap
              ? "out"
              : "racing";

    const special =
      state === "retired" ? "dnf" : state === "pit" ? "pit" : null;
    let gap: TowerGap;
    let interval: TowerGap;
    if (special) {
      gap = interval = { type: "label", label: special };
    } else if (car.position === 1) {
      gap = interval = {
        type: "label",
        label: state === "finished" ? "winner" : "leader",
      };
    } else if (car.lapsDown > 0) {
      gap = interval = { type: "laps", laps: car.lapsDown };
    } else {
      gap =
        car.gapToLeader === null
          ? { type: "label", label: "none" }
          : { type: "time", seconds: car.gapToLeader };
      interval =
        car.interval === null ? gap : { type: "time", seconds: car.interval };
    }

    return {
      index,
      driverId: car.driverId,
      position: car.position,
      code: car.code,
      lastName: driver.lastName,
      teamColor: team.color,
      teamId: team.id,
      isPlayer: car.isPlayer,
      gap,
      interval,
      compound: car.tyre.compound,
      tyreAge: car.tyre.age,
      wear: car.tyre.wear,
      stops: car.pitStops.length,
      state,
      gained: car.status === "retired" ? 0 : car.gridPosition - car.position,
      boost: car.boost?.kind ?? null,
      lastLap: car.lastLapTime,
      bestLap: car.bestLapTime,
      fastestLap: race.fastestLap?.car === index,
    };
  });
}
