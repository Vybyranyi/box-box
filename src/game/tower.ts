import type { Compound, Race } from "@/engine";
import { formatGap } from "@/lib/format";

export type TowerRow = {
  index: number;
  driverId: string;
  position: number;
  code: string;
  lastName: string;
  teamColor: string;
  teamId: string;
  isPlayer: boolean;
  /** Gap to the leader, already formatted. */
  gap: string;
  /** Interval to the car ahead, already formatted. */
  interval: string;
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
};

const lapsText = (n: number) => `+${n} LAP${n > 1 ? "S" : ""}`;

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
      state === "retired" ? "DNF" : state === "pit" ? "PIT" : null;
    let gap: string;
    let interval: string;
    if (special) {
      gap = interval = special;
    } else if (car.position === 1) {
      gap = interval = state === "finished" ? "WINNER" : "LEADER";
    } else if (car.lapsDown > 0) {
      gap = interval = lapsText(car.lapsDown);
    } else {
      gap = car.gapToLeader === null ? "-" : formatGap(car.gapToLeader);
      interval = car.interval === null ? gap : formatGap(car.interval);
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
      lastLap: car.lastLapTime,
      bestLap: car.bestLapTime,
      fastestLap: race.fastestLap?.car === index,
    };
  });
}
