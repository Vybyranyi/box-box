import type { Driver, Team, Track } from "@/data/types";
import {
  expectedLapTime,
  FULL_RACE_FUEL_KG,
  lapNoise,
  PACE_MODE,
  referenceLap,
} from "./pace";
import { simulateQualifying } from "./qualifying";
import { createRng, type Rng } from "./rng";
import {
  decidePit,
  jitterStopLap,
  planStrategy,
  type WearRates,
} from "./strategy";
import {
  DRY_COMPOUNDS,
  idealCompoundFor,
  isDry,
  PUNCTURE_WEAR,
  wearPerLap,
} from "./tyres";
import type {
  CarState,
  ClassifiedResult,
  Compound,
  DryCompound,
  QualifyingResult,
  RaceCommand,
  RaceConfig,
  RaceEvent,
  SafetyCarState,
  StrategyPlan,
  TeamOrder,
  TimedEvent,
  WeatherState,
} from "./types";
import { generateWeather, initialWeather, updateWeather } from "./weather";

/** Simulation step in seconds of race time. */
export const DT = 0.5;
/** Timing points per lap, used for live gaps (like F1's mini-sectors). */
const TIMING_POINTS = 25;
const GRID_SPACING = 8;
const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

/** Per-lap chance of an overtake with a 1 s/lap pace advantage, by overtaking difficulty 1..5. */
const OVERTAKE_BASE = [0.6, 0.4, 0.25, 0.12, 0.04];
/** Chance a crash brings out the SC / VSC; the rest are cleared under yellows. */
const CRASH_SC = 0.5;
const CRASH_VSC = 0.3;
const MECHANICAL_SC = 0.1;
const MECHANICAL_VSC = 0.3;
const CRASH_CALIBRATION = 1.4;
/** Spread of each car's pace from weekend to weekend, in % of lap time. */
const WEEKEND_FORM_SIGMA = 0.22;

export type Phase = "racing" | "finishing" | "finished";

export class Race {
  readonly config: RaceConfig;
  readonly track: Track;
  readonly laps: number;
  readonly lapLength: number;
  readonly requireTwoCompounds: boolean;
  readonly qualifying: QualifyingResult[] | null;

  readonly cars: CarState[];
  /** Cars in classification order (indices into `cars`). */
  order: number[] = [];
  time = 0;
  tick = 0;
  phase: Phase = "racing";
  leaderLap = 0;
  safetyCar: SafetyCarState = {
    status: "green",
    endsOnLap: null,
    endsAt: null,
    deployments: [],
  };
  weather: WeatherState;
  teamOrders: Record<string, TeamOrder> = {};
  fastestLap: { car: number; time: number; lap: number } | null = null;
  readonly events: TimedEvent[] = [];
  readonly commandLog: { tick: number; command: RaceCommand }[] = [];

  private readonly driverOf: Driver[];
  private readonly teamOf: Team[];
  private readonly wearRates: WearRates[];
  private readonly rng: Rng;
  private readonly refLap: number;
  private readonly scSpeed: number;
  private readonly crashRatePerCarLap: number;
  private readonly fuelPerLap: number;
  private readonly startDelay: number[];
  private queue: RaceCommand[] = [];
  private firstPass: number[] = [];
  private timingPoint: number[];
  private timingTime: number[];
  private neutralisationId = 0;
  private stoppedUnder: number[];
  private tyreWarned: boolean[];
  private raining = false;
  private idealTyre: "dry" | "intermediate" | "wet" = "dry";
  /** Cars letting a teammate through on a team order. */
  private yielding = new Set<number>();
  private newEvents: TimedEvent[] = [];

  constructor(config: RaceConfig) {
    this.config = config;
    this.track = config.track;
    this.laps = config.laps ?? config.track.laps;
    this.lapLength = config.track.lengthMeters;
    this.requireTwoCompounds =
      config.requireTwoCompounds ?? this.laps >= config.track.laps * 0.5;
    this.refLap = referenceLap(this.track);
    this.scSpeed = this.lapLength / (this.refLap * 1.45);
    this.fuelPerLap = FULL_RACE_FUEL_KG / this.track.laps;

    // Independent random streams: the player's choices must not change weather or reliability.
    this.rng = createRng(config.seed);
    const weatherRng = createRng(config.seed ^ 0x51ed270b);
    const mechRng = createRng(config.seed ^ 0x2545f491);

    const timeline = generateWeather(
      config.weather ?? "auto",
      this.track.rainProbability,
      this.laps * this.refLap * 1.1,
      weatherRng,
    );
    this.weather = initialWeather(timeline);
    this.raining = this.weather.rain > 0.05;
    this.idealTyre = idealCompoundFor(this.weather.wetness);

    // Expected crashes per race chosen so P(at least one SC) matches the track's history. The
    // divisor accounts for the average of the risk multipliers (lap 1, rain, weaker drivers)
    // and for SCs caused by mechanical failures; it is calibrated with `npm run sim -- --runs`.
    const crashesPerRace =
      -Math.log(1 - Math.min(0.95, this.track.safetyCarProbability)) / CRASH_SC;
    this.crashRatePerCarLap =
      crashesPerRace /
      (config.drivers.length * this.track.laps) /
      CRASH_CALIBRATION;

    // Weekend form: cars suit some circuits and conditions better than others.
    const formRng = createRng(config.seed ^ 0x7f4a7c15);
    const teams = config.teams.map((t) => ({
      ...t,
      car: {
        ...t.car,
        paceDeficitPct:
          t.car.paceDeficitPct + formRng.normal(0, WEEKEND_FORM_SIGMA),
      },
    }));
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const driverById = new Map(config.drivers.map((d) => [d.id, d]));
    this.qualifying = config.grid
      ? null
      : simulateQualifying({
          seed: config.seed,
          track: this.track,
          teams,
          drivers: config.drivers,
          wetness: this.weather.wetness,
        });
    const grid = config.grid ?? this.qualifying!.map((q) => q.driverId);

    this.driverOf = grid.map((id) => {
      const d = driverById.get(id);
      if (!d) throw new Error(`Unknown driver "${id}" on the grid`);
      return d;
    });
    this.teamOf = this.driverOf.map((d) => teamById.get(d.teamId)!);
    this.wearRates = this.driverOf.map((d, i) => {
      const rates = {} as WearRates;
      for (const c of DRY_COMPOUNDS) {
        rates[c] = wearPerLap({
          compound: c,
          tyreDegradation: this.track.tyreDegradation,
          carTyreWear: this.teamOf[i].car.tyreWear,
          tyreManagement: d.ratings.tyreManagement,
          paceModeWear: 1,
          wetness: 0,
        });
      }
      return rates;
    });

    const distanceShare = this.laps / this.track.laps;
    this.cars = this.driverOf.map((driver, index) => {
      const team = this.teamOf[index];
      const isPlayer = config.playerTeamId === team.id;
      const ai = isPlayer ? null : this.initialAi(index);
      const startWet = idealCompoundFor(this.weather.wetness);
      const compound: Compound =
        config.startingTyres?.[driver.id] ??
        (startWet !== "dry"
          ? startWet
          : (ai?.plan.stints[0].compound ?? "medium"));
      const failsThisRace = mechRng.chance(
        (1 - team.car.reliability) * distanceShare,
      );
      const failureLap = mechRng.next() * this.laps;

      const car: CarState = {
        index,
        driverId: driver.id,
        teamId: team.id,
        code: driver.code,
        isPlayer,
        status: "racing",
        retiredReason: null,
        lap: 0,
        lapDistance: -5 - index * GRID_SPACING,
        speed: 0,
        tyre: { compound, wear: 0, age: 0 },
        usedCompounds: [compound],
        stints: [{ compound, startLap: 0, endLap: null }],
        fuelKg: this.laps * this.fuelPerLap + 0.5,
        paceMode: "balanced",
        lapTimeTarget: 0,
        lapStartTime: 0,
        lastLapTime: null,
        bestLapTime: null,
        lapTimes: [],
        pitRequest: null,
        pitTimeLeft: 0,
        pitStops: [],
        outLap: false,
        punctured: false,
        incidentAt: null,
        failureLap: failsThisRace ? Math.floor(failureLap) : null,
        passing: null,
        position: index + 1,
        gridPosition: index + 1,
        gapToLeader: null,
        interval: null,
        lapsDown: 0,
        finishTime: null,
        disqualified: false,
        ai,
      };
      return car;
    });

    this.startDelay = this.cars.map((c) =>
      Math.max(
        0,
        this.rng.normal(0.25, 0.12) +
          (85 - this.driverOf[c.index].ratings.racecraft) * 0.01,
      ),
    );
    this.timingPoint = this.cars.map(() => -1);
    this.timingTime = this.cars.map(() => 0);
    this.stoppedUnder = this.cars.map(() => -1);
    this.tyreWarned = this.cars.map(() => false);
    for (const car of this.cars) this.startLap(car);
    this.updateOrder();
    this.emit({ type: "start" });
  }

  // ------------------------------------------------------------------ public API

  driver(car: CarState): Driver {
    return this.driverOf[car.index];
  }

  team(car: CarState): Team {
    return this.teamOf[car.index];
  }

  /** Green-flag tyre wear in % per lap for this car at the current conditions and pace mode. */
  wearRate(car: CarState): number {
    return this.currentWearRate(car, false);
  }

  /**
   * The best dry strategy for this car from now on, for advising the player. With `fromScratch`
   * it plans the whole race including the starting tyre (before the start).
   */
  suggestStrategy(car: CarState, fromScratch = false): StrategyPlan {
    const current =
      !fromScratch && isDry(car.tyre.compound)
        ? { compound: car.tyre.compound, wear: car.tyre.wear }
        : undefined;
    return planStrategy({
      fromLap: car.lap,
      totalLaps: this.laps,
      wearRates: this.wearRates[car.index],
      referenceLap: this.refLap,
      pitLaneLoss: this.track.pitLaneLossSeconds,
      overtakingDifficulty: this.track.overtakingDifficulty,
      requireTwoCompounds: this.requireTwoCompounds,
      usedCompounds: fromScratch ? [] : car.usedCompounds,
      current,
    });
  }

  carByDriver(driverId: string): CarState | undefined {
    return this.cars.find((c) => c.driverId === driverId);
  }

  get trackStatus() {
    return this.safetyCar.status;
  }

  get finished() {
    return this.phase === "finished";
  }

  /** Queue a player command; it is applied at the start of the next step. */
  command(command: RaceCommand): void {
    this.queue.push(command);
  }

  /** Advance one step and return the events it produced. */
  step(): TimedEvent[] {
    this.newEvents = [];
    if (this.phase === "finished") return this.newEvents;
    this.applyCommands();
    this.time += DT;
    this.tick++;

    this.updateWeather();
    this.updateVsc();
    this.updatePitLane();
    this.updateSpeeds();
    this.move();
    this.updateOrder();
    this.checkFinished();
    return this.newEvents;
  }

  /** Run until the chequered flag (or a safety cap) and return the classification. */
  run(maxSeconds = this.laps * this.refLap * 4): ClassifiedResult[] {
    while (!this.finished && this.time < maxSeconds) this.step();
    if (!this.finished) this.phase = "finished";
    return this.classification();
  }

  classification(): ClassifiedResult[] {
    const winner = this.cars[this.order[0]];
    const winnerLaps = Math.max(...this.cars.map((c) => c.lap));
    let pointsPosition = 0;
    return this.order.map((index, i) => {
      const car = this.cars[index];
      const status: ClassifiedResult["status"] = car.disqualified
        ? "dsq"
        : car.status === "retired"
          ? "dnf"
          : car.lap < winnerLaps
            ? "lapped"
            : "finished";
      // Retired cars that covered 90% of the distance are still classified.
      const classified =
        status === "finished" ||
        status === "lapped" ||
        (status === "dnf" && car.lap >= winnerLaps * 0.9);
      const points = classified ? (POINTS[pointsPosition++] ?? 0) : 0;
      return {
        position: i + 1,
        driverId: car.driverId,
        teamId: car.teamId,
        code: car.code,
        status,
        laps: car.lap,
        gap:
          status === "finished" &&
          car.finishTime !== null &&
          winner.finishTime !== null
            ? car.finishTime - winner.finishTime
            : null,
        totalTime: car.finishTime,
        bestLap: car.bestLapTime,
        pitStops: car.pitStops.length,
        points,
        gridPosition: car.gridPosition,
      };
    });
  }

  // ------------------------------------------------------------------ setup helpers

  private initialAi(index: number): NonNullable<CarState["ai"]> {
    const plan = planStrategy({
      fromLap: 0,
      totalLaps: this.laps,
      wearRates: this.wearRates[index],
      referenceLap: this.refLap,
      pitLaneLoss: this.track.pitLaneLossSeconds,
      overtakingDifficulty: this.track.overtakingDifficulty,
      requireTwoCompounds: this.requireTwoCompounds,
      usedCompounds: [],
      rng: this.rng,
    });
    // Most pit walls react within a lap or two; occasionally one gets it badly wrong.
    const weatherReaction = this.rng.chance(0.1)
      ? 3 + Math.floor(this.rng.next() * 2)
      : Math.floor(this.rng.next() * 3);
    return {
      plan,
      nextStopLap: jitterStopLap(plan.stints[0].endLap, this.laps, 0, this.rng),
      weatherReaction,
      weatherMismatchLaps: 0,
    };
  }

  private replan(car: CarState, fresh: DryCompound | null) {
    if (!car.ai) return;
    const plan = planStrategy({
      fromLap: car.lap,
      totalLaps: this.laps,
      wearRates: this.wearRates[car.index],
      referenceLap: this.refLap,
      pitLaneLoss: this.track.pitLaneLossSeconds,
      overtakingDifficulty: this.track.overtakingDifficulty,
      requireTwoCompounds: this.requireTwoCompounds,
      usedCompounds: car.usedCompounds,
      current: isDry(car.tyre.compound)
        ? { compound: car.tyre.compound, wear: car.tyre.wear }
        : undefined,
      rng: this.rng,
    });
    if (fresh && plan.stints[0]) plan.stints[0].compound = fresh;
    car.ai.plan = plan;
    car.ai.nextStopLap = jitterStopLap(
      plan.stints[0].endLap,
      this.laps,
      car.lap,
      this.rng,
    );
  }

  // ------------------------------------------------------------------ step parts

  private emit(event: RaceEvent) {
    const timed = {
      ...event,
      seq: this.events.length,
      time: this.time,
      lap: this.leaderLap,
    } as TimedEvent;
    this.events.push(timed);
    this.newEvents.push(timed);
  }

  private applyCommands() {
    for (const command of this.queue) {
      this.commandLog.push({ tick: this.tick, command });
      if (command.type === "team-order") {
        this.teamOrders[command.teamId] = command.order;
        this.emit({
          type: "team-order",
          teamId: command.teamId,
          order: command.order,
        });
        continue;
      }
      const car = this.carByDriver(command.driverId);
      if (!car || car.status === "retired" || car.status === "finished")
        continue;
      if (command.type === "pit") car.pitRequest = command.compound;
      else if (command.type === "cancel-pit" && !car.punctured)
        car.pitRequest = null;
      else if (command.type === "pace") car.paceMode = command.mode;
    }
    this.queue = [];
  }

  private updateWeather() {
    updateWeather(this.weather, this.time, DT);
    if (!this.raining && this.weather.rain > 0.05) {
      this.raining = true;
      this.emit({ type: "rain-start" });
    } else if (this.raining && this.weather.rain < 0.03) {
      this.raining = false;
      this.emit({ type: "rain-stop" });
    }
    const ideal = idealCompoundFor(this.weather.wetness);
    if (ideal !== this.idealTyre) {
      this.idealTyre = ideal;
      this.emit({ type: "crossover", to: ideal });
    }
  }

  private updateVsc() {
    const sc = this.safetyCar;
    if (sc.status === "vsc" && sc.endsAt !== null && this.time >= sc.endsAt) {
      sc.status = "green";
      sc.endsAt = null;
      this.emit({ type: "vsc-ending" });
      this.emit({ type: "green" });
    }
  }

  private updatePitLane() {
    for (const car of this.cars) {
      if (car.status !== "pit") continue;
      car.pitTimeLeft -= DT;
      if (car.pitTimeLeft <= 0) {
        car.status = "racing";
        car.lapDistance =
          -car.pitTimeLeft * (this.lapLength / car.lapTimeTarget);
        const stop = car.pitStops[car.pitStops.length - 1];
        this.emit({
          type: "pit-exit",
          car: car.index,
          stationarySeconds: stop.stationarySeconds,
          slow: stop.stationarySeconds > 4,
        });
        this.startLap(car);
      }
    }
  }

  /** Physical distance to the next racing car ahead on track, and which car it is. */
  private carAhead(
    car: CarState,
    racing: CarState[],
  ): { other: CarState; distance: number } | null {
    let best: { other: CarState; distance: number } | null = null;
    const L = this.lapLength;
    for (const other of racing) {
      if (other === car) continue;
      const d = (((other.lapDistance - car.lapDistance) % L) + L) % L;
      if (d > 0 && (!best || d < best.distance)) best = { other, distance: d };
    }
    return best;
  }

  private raceDistance(car: CarState) {
    return (
      car.lap * this.lapLength +
      (car.status === "finished" ? 0 : car.lapDistance)
    );
  }

  private updateSpeeds() {
    const L = this.lapLength;
    const racing = this.cars.filter((c) => c.status === "racing");
    // Front to back, so each car reacts to the car ahead's final speed.
    racing.sort(
      (a, b) =>
        this.raceDistance(b) - this.raceDistance(a) || a.index - b.index,
    );
    const status = this.safetyCar.status;
    const leader = racing[0];

    for (const car of racing) {
      let speed = L / car.lapTimeTarget;
      if (car.punctured) speed *= 0.55;
      const launch = Math.min(
        1,
        Math.max(0, (this.time - this.startDelay[car.index]) / 5),
      );
      if (this.leaderLap === 0 && car.lap === 0) speed *= launch;

      const ahead = this.carAhead(car, racing);
      const gapSeconds = ahead ? ahead.distance / Math.max(speed, 1) : Infinity;

      if (status === "vsc") {
        speed *= 0.65;
      } else if (status === "sc") {
        // The leader follows the Safety Car; everyone else closes up to the queue.
        speed =
          car === leader
            ? Math.min(speed, this.scSpeed)
            : gapSeconds > 0.8
              ? Math.min(speed, this.scSpeed * 1.6)
              : this.scSpeed;
      } else if (ahead && gapSeconds < 1) {
        // Dirty air: harder to follow closely.
        speed = L / (car.lapTimeTarget + 0.35 * (1 - gapSeconds));
      }

      if (this.yielding.has(car.index)) speed *= 0.9;

      if (car.passing) {
        const target = this.cars[car.passing.targetIndex];
        const d = (((target.lapDistance - car.lapDistance) % L) + L) % L;
        const done =
          target.status !== "racing" ||
          d > L / 2 ||
          this.time > car.passing.until;
        if (done) {
          car.passing = null;
          this.yielding.delete(target.index);
        } else speed = Math.max(speed, target.speed + 2.5);
      }

      if (
        !car.passing &&
        ahead &&
        ahead.distance < Math.max(18, speed * 0.3) &&
        speed > ahead.other.speed
      ) {
        if (status === "green" && this.tryOvertake(car, ahead.other)) {
          car.passing = {
            targetIndex: ahead.other.index,
            until: this.time + 8,
          };
          speed = ahead.other.speed + 2.5;
        } else {
          speed = Math.min(speed, ahead.other.speed);
        }
      }

      this.applyTeamOrder(car, ahead?.other ?? null, gapSeconds);
      car.speed = speed;
    }

    for (const car of this.cars) {
      if (car.status === "finished") car.speed = (L / car.lapTimeTarget) * 0.5;
      else if (car.status !== "racing") car.speed = 0;
    }
  }

  private tryOvertake(car: CarState, defender: CarState): boolean {
    const L = this.lapLength;
    const lapping =
      this.raceDistance(car) > this.raceDistance(defender) + L / 2;
    const teammates = car.teamId === defender.teamId;
    if (teammates && this.teamOrders[car.teamId] === "hold" && !lapping)
      return false;

    let perLap: number;
    if (lapping) {
      perLap = 0.9; // blue flags
    } else {
      const delta = defender.lapTimeTarget - car.lapTimeTarget;
      const difficulty = Math.min(
        5,
        Math.max(1, this.track.overtakingDifficulty),
      );
      const rc =
        1 +
        (this.driverOf[car.index].ratings.racecraft -
          this.driverOf[defender.index].ratings.racecraft) *
          0.025;
      perLap =
        OVERTAKE_BASE[difficulty - 1] *
        Math.min(3, Math.max(0, (delta - 0.1) / 0.9)) *
        Math.max(0.2, rc) *
        (car.lap === 0 ? 2 : 1);
    }
    const perTick =
      1 - Math.pow(1 - Math.min(0.95, perLap), DT / car.lapTimeTarget);
    if (!this.rng.chance(perTick)) return false;
    if (!lapping)
      this.emit({ type: "overtake", car: car.index, on: defender.index });
    return true;
  }

  private applyTeamOrder(
    car: CarState,
    ahead: CarState | null,
    gapSeconds: number,
  ) {
    if (
      this.teamOrders[car.teamId] !== "swap" ||
      !ahead ||
      ahead.teamId !== car.teamId
    )
      return;
    if (gapSeconds > 2.5 || this.safetyCar.status !== "green") return;
    car.passing = { targetIndex: ahead.index, until: this.time + 30 };
    this.yielding.add(ahead.index);
    this.teamOrders[car.teamId] = "free";
    this.emit({ type: "overtake", car: car.index, on: ahead.index });
  }

  private move() {
    const L = this.lapLength;
    for (const car of this.cars) {
      if (car.status !== "racing" && car.status !== "finished") continue;
      const travelled = car.speed * DT;
      const prevDistance = car.lapDistance;
      car.lapDistance += travelled;
      if (car.status === "finished") {
        car.lapDistance %= L;
        continue;
      }

      const share = travelled / L;
      car.tyre.wear += share * this.currentWearRate(car);
      car.fuelKg = Math.max(0, car.fuelKg - share * this.fuelPerLap);

      if (
        car.incidentAt &&
        prevDistance < car.incidentAt.distance &&
        car.lapDistance >= car.incidentAt.distance
      ) {
        this.retire(car, car.incidentAt.kind);
        continue;
      }

      this.recordTimingPoints(car);
      if (car.lapDistance >= L) {
        car.lapDistance -= L;
        const crossedAt = this.time - car.lapDistance / Math.max(car.speed, 1);
        this.completeLap(car, crossedAt);
      }
    }
  }

  private currentWearRate(
    car: CarState,
    neutralised = this.safetyCar.status !== "green",
  ) {
    const driver = this.driverOf[car.index];
    return wearPerLap({
      compound: car.tyre.compound,
      tyreDegradation: this.track.tyreDegradation,
      carTyreWear: this.teamOf[car.index].car.tyreWear,
      tyreManagement: driver.ratings.tyreManagement,
      paceModeWear: PACE_MODE[car.paceMode].wear * (neutralised ? 0.4 : 1),
      wetness: this.weather.wetness,
    });
  }

  private recordTimingPoints(car: CarState) {
    if (car.lapDistance < 0) return;
    const L = this.lapLength;
    const point =
      car.lap * TIMING_POINTS +
      Math.floor((Math.min(car.lapDistance, L - 0.001) / L) * TIMING_POINTS);
    for (let k = this.timingPoint[car.index] + 1; k <= point; k++) {
      const pointDistance = (k - car.lap * TIMING_POINTS) * (L / TIMING_POINTS);
      const t =
        this.time - (car.lapDistance - pointDistance) / Math.max(car.speed, 1);
      if (this.firstPass[k] === undefined) this.firstPass[k] = t;
      this.timingTime[car.index] = t;
    }
    this.timingPoint[car.index] = Math.max(this.timingPoint[car.index], point);
  }

  private completeLap(car: CarState, crossedAt: number) {
    car.lap++;
    const lapTime = crossedAt - car.lapStartTime;
    car.lapStartTime = crossedAt;
    car.lapTimes.push(lapTime);
    car.lastLapTime = lapTime;
    car.tyre.age++;
    car.outLap = false;
    if (car.bestLapTime === null || lapTime < car.bestLapTime)
      car.bestLapTime = lapTime;
    if (car.lap > 1 && (!this.fastestLap || lapTime < this.fastestLap.time)) {
      this.fastestLap = { car: car.index, time: lapTime, lap: car.lap };
      this.emit({ type: "fastest-lap", car: car.index, lapTime });
    }

    if (car.lap > this.leaderLap) {
      this.leaderLap = car.lap;
      if (this.phase === "racing") this.emit({ type: "lap", lap: car.lap });
      this.updateSafetyCarOnLeaderLap();
    }

    if (this.phase === "racing" && car.lap >= this.laps) {
      this.phase = "finishing";
      this.emit({ type: "chequered-flag" });
    }
    if (this.phase === "finishing") {
      this.finish(car, crossedAt);
      return;
    }

    if (!this.tyreWarned[car.index] && car.tyre.wear >= 70) {
      this.tyreWarned[car.index] = true;
      this.emit({ type: "tyre-warning", car: car.index, wear: car.tyre.wear });
    }
    if (
      !car.punctured &&
      car.tyre.wear > PUNCTURE_WEAR &&
      this.rng.chance(0.12)
    ) {
      car.punctured = true;
      this.emit({ type: "puncture", car: car.index });
    }

    if (car.ai) this.aiDecisions(car);
    if (car.punctured && !car.pitRequest)
      car.pitRequest = this.laps - car.lap > 20 ? "hard" : "medium";

    if (car.pitRequest && this.laps - car.lap > 0) this.enterPit(car);
    else this.startLap(car);
  }

  private aiDecisions(car: CarState) {
    const ai = car.ai!;
    const ideal = idealCompoundFor(this.weather.wetness);
    const fitted = isDry(car.tyre.compound) ? "dry" : car.tyre.compound;
    ai.weatherMismatchLaps = ideal === fitted ? 0 : ai.weatherMismatchLaps + 1;

    const decision = decidePit({
      lap: car.lap,
      totalLaps: this.laps,
      compound: car.tyre.compound,
      wear: car.tyre.wear,
      tyreAge: car.tyre.age,
      wetness: this.weather.wetness,
      trackStatus: this.safetyCar.status,
      stoppedUnderThisNeutralisation:
        this.stoppedUnder[car.index] === this.neutralisationId,
      plan: ai.plan,
      nextStopLap: ai.nextStopLap,
      weatherMismatchLaps: ai.weatherMismatchLaps,
      weatherReaction: ai.weatherReaction,
      requireTwoCompounds: this.requireTwoCompounds,
      usedCompounds: car.usedCompounds,
      rng: this.rng,
    });
    if (decision.pit) car.pitRequest = decision.compound;

    const remaining = this.laps - car.lap;
    if (
      car.tyre.wear > 62 &&
      ai.nextStopLap !== null &&
      ai.nextStopLap - car.lap > 3
    )
      car.paceMode = "conserve";
    else if (remaining <= 3 && car.interval !== null && car.interval < 1.2)
      car.paceMode = "push";
    else car.paceMode = "balanced";
  }

  private enterPit(car: CarState) {
    const compound = car.pitRequest!;
    let stationary = Math.min(3.2, Math.max(1.9, this.rng.normal(2.4, 0.25)));
    if (this.rng.chance(0.06)) stationary += this.rng.range(1.5, 5.5);
    else if (this.rng.chance(0.01)) stationary += this.rng.range(6, 12);

    const underSafetyCar = this.safetyCar.status !== "green";
    if (underSafetyCar) this.stoppedUnder[car.index] = this.neutralisationId;
    const from = car.tyre.compound;
    car.pitStops.push({
      lap: car.lap,
      from,
      to: compound,
      stationarySeconds: stationary,
      underSafetyCar,
    });
    car.stints[car.stints.length - 1].endLap = car.lap;
    car.stints.push({ compound, startLap: car.lap, endLap: null });
    if (!car.usedCompounds.includes(compound)) car.usedCompounds.push(compound);
    car.tyre = { compound, wear: 0, age: 0 };
    car.outLap = true;
    car.punctured = false;
    car.pitRequest = null;
    car.passing = null;
    car.status = "pit";
    car.pitTimeLeft = this.track.pitLaneLossSeconds + stationary;
    car.lapDistance = 0;
    this.tyreWarned[car.index] = false;
    this.emit({ type: "pit-entry", car: car.index, compound });

    if (car.ai) {
      const plannedNext = car.ai.plan.stints[1];
      if (plannedNext && plannedNext.compound === compound && !underSafetyCar) {
        car.ai.plan = { stints: car.ai.plan.stints.slice(1) };
        car.ai.nextStopLap = jitterStopLap(
          car.ai.plan.stints[0].endLap,
          this.laps,
          car.lap,
          this.rng,
        );
      } else {
        this.replan(car, isDry(compound) ? compound : null);
      }
    }
  }

  /** Roll this lap's target time and whether something goes wrong on it. */
  private startLap(car: CarState) {
    const driver = this.driverOf[car.index];
    const wetness = this.weather.wetness;
    const expected = expectedLapTime({
      track: this.track,
      team: this.teamOf[car.index],
      driver,
      compound: car.tyre.compound,
      wear: car.tyre.wear,
      fuelKg: car.fuelKg,
      wetness,
      paceMode: car.paceMode,
      outLap: car.outLap,
    });
    const { noise } = lapNoise(driver, wetness, this.rng);
    car.lapTimeTarget = Math.max(expected * 0.97, expected + noise);

    car.incidentAt = null;
    if (car.failureLap !== null && car.failureLap === car.lap) {
      car.incidentAt = {
        distance: this.rng.range(0.05, 0.95) * this.lapLength,
        kind: "mechanical",
      };
      return;
    }
    const dryOnWet = isDry(car.tyre.compound) && wetness > 0.2;
    const risk =
      this.crashRatePerCarLap *
      (1 + (85 - driver.ratings.consistency) * 0.04) *
      PACE_MODE[car.paceMode].risk *
      (1 + wetness * 2) *
      (dryOnWet ? 4 : 1) *
      (car.lap === 0 ? 5 : 1) *
      (car.punctured ? 3 : 1);
    if (this.rng.chance(risk)) {
      car.incidentAt = {
        distance: this.rng.range(0.03, 0.97) * this.lapLength,
        kind: "crash",
      };
    }
  }

  private retire(car: CarState, kind: "crash" | "mechanical") {
    car.status = "retired";
    car.retiredReason = kind;
    car.speed = 0;
    car.incidentAt = null;
    car.pitRequest = null;
    this.emit({ type: kind, car: car.index });
    if (this.phase !== "racing") return;

    const roll = this.rng.next();
    const [scChance, vscChance] =
      kind === "crash"
        ? [CRASH_SC, CRASH_VSC]
        : [MECHANICAL_SC, MECHANICAL_VSC];
    const lapsLeft = this.laps - this.leaderLap;
    if (roll < scChance && lapsLeft > 2) this.deploySafetyCar();
    else if (roll < scChance + vscChance && lapsLeft > 1) this.deployVsc();
  }

  private deploySafetyCar() {
    const sc = this.safetyCar;
    if (sc.status === "sc") return;
    sc.status = "sc";
    sc.endsAt = null;
    sc.endsOnLap = this.leaderLap + 3 + Math.floor(this.rng.next() * 3);
    sc.deployments.push({ type: "sc", lap: this.leaderLap });
    this.neutralisationId++;
    this.emit({ type: "sc-deployed" });
  }

  private deployVsc() {
    const sc = this.safetyCar;
    if (sc.status !== "green") return;
    sc.status = "vsc";
    sc.endsAt = this.time + this.rng.range(1, 2.5) * this.refLap;
    sc.deployments.push({ type: "vsc", lap: this.leaderLap });
    this.neutralisationId++;
    this.emit({ type: "vsc-deployed" });
  }

  private updateSafetyCarOnLeaderLap() {
    const sc = this.safetyCar;
    if (sc.status !== "sc" || sc.endsOnLap === null) return;
    if (this.leaderLap === sc.endsOnLap - 1) this.emit({ type: "sc-ending" });
    if (this.leaderLap >= sc.endsOnLap) {
      sc.status = "green";
      sc.endsOnLap = null;
      this.emit({ type: "green" });
    }
  }

  private finish(car: CarState, crossedAt: number) {
    car.status = "finished";
    car.finishTime = crossedAt;
    car.pitRequest = null;
    const wetUsed = car.usedCompounds.some((c) => !isDry(c));
    const dryUsed = new Set(car.usedCompounds.filter(isDry)).size;
    if (this.requireTwoCompounds && !wetUsed && dryUsed < 2) {
      car.disqualified = true;
      this.emit({
        type: "disqualified",
        car: car.index,
        reason: "Did not use two dry compounds",
      });
    }
    this.updateOrder();
    this.emit({ type: "finished", car: car.index, position: car.position });
  }

  private updateOrder() {
    const rank = (c: CarState) =>
      c.disqualified ? 2 : c.status === "retired" ? 1 : 0;
    const order = [...this.cars].sort((a, b) => {
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      const byDistance = this.raceDistance(b) - this.raceDistance(a);
      if (byDistance !== 0) return byDistance;
      if (a.finishTime !== null && b.finishTime !== null)
        return a.finishTime - b.finishTime;
      return a.index - b.index;
    });
    this.order = order.map((c) => c.index);

    const leader = order[0];
    const leaderDistance = this.raceDistance(leader);
    order.forEach((car, i) => {
      car.position = i + 1;
      car.lapsDown = Math.max(
        0,
        Math.floor((leaderDistance - this.raceDistance(car)) / this.lapLength),
      );
      if (
        car.status === "finished" &&
        leader.finishTime !== null &&
        car.finishTime !== null &&
        car.lapsDown === 0
      ) {
        car.gapToLeader = car.finishTime - leader.finishTime;
      } else {
        const point = this.timingPoint[car.index];
        car.gapToLeader =
          point >= 0 && this.firstPass[point] !== undefined
            ? this.timingTime[car.index] - this.firstPass[point]
            : null;
      }
      const prev = order[i - 1];
      car.interval =
        prev &&
        car.gapToLeader !== null &&
        prev.gapToLeader !== null &&
        car.lapsDown === prev.lapsDown
          ? Math.max(0, car.gapToLeader - prev.gapToLeader)
          : null;
    });
  }

  private checkFinished() {
    if (
      this.phase === "finishing" &&
      this.cars.every((c) => c.status === "finished" || c.status === "retired")
    ) {
      this.phase = "finished";
    }
    if (
      this.phase === "racing" &&
      this.cars.every((c) => c.status === "retired")
    )
      this.phase = "finished";
  }
}

export function createRace(config: RaceConfig): Race {
  return new Race(config);
}
