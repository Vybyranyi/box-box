import type { Driver, Team, Track } from "@/data/types";
import { carFactor, driverDelta, lapNoiseSigma, referenceLap } from "./pace";
import { startingWetness, weekendTeams } from "./race";
import { createRng, type Rng } from "./rng";
import { compoundOffset, conditionPenalty, idealCompoundFor } from "./tyres";
import type { Compound, QualifyingResult, RaceConfig } from "./types";

/**
 * Playable knockout qualifying. Three timed parts (Q1 18 min, Q2 15, Q3 12). In each one a
 * car does runs: an out-lap, one or two timed laps, an in-lap, then a tyre change in the
 * garage. Laps get faster as the track rubbers in, but the end of each part is crowded
 * (traffic) and a lap only counts if it starts before the chequered flag. The slowest six
 * drop out after Q1 and Q2; the top ten fight for pole in Q3.
 *
 * Deterministic: the same config and the same commands give the same session.
 */

export type QualiTyre =
  "soft-new" | "soft-used" | "medium" | "intermediate" | "wet";

export type QualiLap = {
  phase: number;
  /** Lap time, or null when deleted for track limits. */
  time: number | null;
  compound: Compound;
  mistake: boolean;
  traffic: boolean;
  deleted: boolean;
  /** Session clock when the lap ended. */
  clock: number;
};

export type QualiCar = {
  index: number;
  driverId: string;
  teamId: string;
  code: string;
  isPlayer: boolean;
  stage: "garage" | "out" | "push" | "in";
  /** Session clock when the current stage ends (on track). */
  stageEndsAt: number;
  stageStartedAt: number;
  /** In the garage: the car can go out again from this clock time (tyre change). */
  readyAt: number;
  compound: Compound;
  /** Timed laps already done on the fitted set. */
  tyreAge: number;
  /** New sets of softs left for the rest of qualifying. */
  softSets: number;
  /** Timed laps still to do in this run. */
  pushLeft: number;
  /** Best lap per part (Q1, Q2, Q3). */
  best: [number | null, number | null, number | null];
  laps: QualiLap[];
  /** Part the car was knocked out in (0 = Q1, 1 = Q2), or null while still in. */
  eliminatedIn: number | null;
  /** Controlled by the AI (always for rivals; for the player's cars after "auto"). */
  auto: boolean;
  /** AI: clock times this part at which to start runs. */
  plan: number[];
};

export type QualiEvent = { seq: number; phase: number; clock: number } & (
  | { type: "run"; car: number; tyre: QualiTyre }
  | { type: "lap"; car: number; lap: QualiLap; position: number | null }
  | { type: "flag"; phase: number }
  | { type: "phase-end"; phase: number; eliminated: number[] }
  | { type: "finished" }
);

export type QualiCommand =
  | { type: "run"; driverId: string; tyre: QualiTyre; pushLaps: 1 | 2 }
  | { type: "abort"; driverId: string }
  /** Hand the car (or all player cars) to the AI for the rest of qualifying. */
  | { type: "auto"; driverId?: string };

export const QUALI_PHASES = [
  { name: "Q1", seconds: 18 * 60 },
  { name: "Q2", seconds: 15 * 60 },
  { name: "Q3", seconds: 12 * 60 },
] as const;

/** Session clock step, s. */
export const QUALI_DT = 1;
/** Cars dropped after Q1 and after Q2. */
const KNOCKOUT = 6;
/** New soft sets each car has for qualifying. */
export const SOFT_SETS = 6;
/** Out-lap and in-lap length as a share of a flying lap. */
const OUT_LAP = 1.35;
const IN_LAP = 1.3;
/** Time in the garage between runs (tyre change, cool-down), s. */
const TYRE_CHANGE = 45;
/** Track evolution between parts, as a lap-time multiplier (same as instant qualifying). */
const EVOLUTION = [1, 0.997, 0.994];
/** Within a part the track rubbers in: the first laps are this much slower (share). */
const RUBBERING = 0.004;
/** Each timed lap already done on a set costs this share of lap time. */
const USED_TYRE = 0.0025;
/** Chance of traffic spoiling a lap: base, per other car on track, cap. */
const TRAFFIC = { base: 0.02, perCar: 0.022, max: 0.4 };
/** Chance a lap is deleted for track limits. */
const TRACK_LIMITS = 0.04;

export class QualiSession {
  readonly config: RaceConfig;
  readonly track: Track;
  readonly cars: QualiCar[];
  readonly events: QualiEvent[] = [];
  /** Part in progress: 0 = Q1, 1 = Q2, 2 = Q3. */
  phase = 0;
  /** Seconds since the start of the current part. */
  clock = 0;
  state: "running" | "break" | "finished" = "running";
  /** Track wetness, constant through qualifying. */
  readonly wetness: number;

  private readonly rng: Rng;
  private readonly teamOf: Team[];
  private readonly driverOf: Driver[];
  private readonly ref: number;
  private queue: QualiCommand[] = [];
  private flagShown = false;
  private newEvents: QualiEvent[] = [];
  /** Lap time of each car's current timed lap, decided when it starts. */
  private pending: (QualiLap | null)[];

  constructor(config: RaceConfig) {
    this.config = config;
    this.track = config.track;
    this.wetness = startingWetness(config);
    this.rng = createRng(config.seed ^ 0x2c1b3c6d);
    const teams = weekendTeams(config);
    const teamById = new Map(teams.map((t) => [t.id, t]));
    this.driverOf = [...config.drivers];
    this.teamOf = this.driverOf.map((d) => teamById.get(d.teamId)!);
    // Same pace basis as instant qualifying: low fuel and fresh softs.
    this.ref =
      this.track.poleTimeSeconds /
      (this.track.fastestRaceLapSeconds / referenceLap(this.track));
    const wet = idealCompoundFor(this.wetness);
    this.cars = this.driverOf.map((d, index) => {
      const isPlayer = d.teamId === config.playerTeamId;
      return {
        index,
        driverId: d.id,
        teamId: d.teamId,
        code: d.code,
        isPlayer,
        stage: "garage",
        stageEndsAt: 0,
        stageStartedAt: 0,
        readyAt: 0,
        compound: wet === "dry" ? "soft" : wet,
        tyreAge: 0,
        softSets: SOFT_SETS,
        pushLeft: 0,
        best: [null, null, null],
        laps: [],
        eliminatedIn: null,
        auto: !isPlayer,
        plan: [],
      };
    });
    this.pending = this.cars.map(() => null);
    for (const car of this.cars) if (car.auto) this.planRuns(car);
  }

  get duration(): number {
    return QUALI_PHASES[this.phase].seconds;
  }

  /** Track conditions call for wet tyres. */
  get wet(): boolean {
    return idealCompoundFor(this.wetness) !== "dry";
  }

  /** Cars still taking part in the current part. */
  get active(): QualiCar[] {
    return this.cars.filter((c) => c.eliminatedIn === null);
  }

  /** How many cars go through to the next part (all of them in Q3). */
  get keep(): number {
    const n = this.cars.length;
    return this.phase === 0
      ? n - KNOCKOUT
      : this.phase === 1
        ? n - 2 * KNOCKOUT
        : n;
  }

  carByDriver(driverId: string): QualiCar | undefined {
    return this.cars.find((c) => c.driverId === driverId);
  }

  command(command: QualiCommand): void {
    this.queue.push(command);
  }

  /** Apply queued commands now, without moving the clock (e.g. while paused). */
  flush(): QualiEvent[] {
    this.newEvents = [];
    if (this.state === "running") this.applyCommands();
    return this.newEvents;
  }

  /** Expected flying-lap time for the car right now, without noise or incidents. */
  expectedLap(
    car: QualiCar,
    compound: Compound = car.compound,
    age = 0,
  ): number {
    const team = this.teamOf[car.index];
    const driver = this.driverOf[car.index];
    const ref = this.ref;
    const wetness = this.wetness;
    const tyre =
      compound === "intermediate" || compound === "wet"
        ? conditionPenalty(compound, wetness, ref) + 4 * (ref / 90)
        : compoundOffset(compound, ref) +
          conditionPenalty(compound, wetness, ref);
    const base =
      ref * carFactor(team, this.track) +
      driverDelta(driver, ref, wetness) +
      wetness * 9 * (ref / 90) +
      tyre +
      age * USED_TYRE * ref;
    const progress = Math.min(1, this.clock / this.duration);
    return base * EVOLUTION[this.phase] * (1 + RUBBERING * (1 - progress));
  }

  /** How much quicker the track will still get by the end of this part, s. */
  evolutionLeft(car: QualiCar): number {
    const left = RUBBERING * (1 - Math.min(1, this.clock / this.duration));
    return (this.expectedLap(car) * left) / (1 + left);
  }

  /** Last clock time to leave the garage and still start a timed lap before the flag. */
  latestStart(car: QualiCar): number {
    return this.duration - this.expectedLap(car) * OUT_LAP;
  }

  /** Other cars on track now (out-laps and timed laps): the traffic a lap would meet. */
  carsOnTrack(except?: QualiCar): number {
    return this.cars.filter(
      (c) => c !== except && (c.stage === "out" || c.stage === "push"),
    ).length;
  }

  /** Chance that traffic spoils a lap started now. */
  trafficChance(except?: QualiCar): number {
    return Math.min(
      TRAFFIC.max,
      TRAFFIC.base + TRAFFIC.perCar * this.carsOnTrack(except),
    );
  }

  /** The current part's order: best lap first, cars without a time last. */
  standings(phase = this.phase): QualiCar[] {
    const inPart = this.cars.filter(
      (c) => c.eliminatedIn === null || c.eliminatedIn >= phase,
    );
    return inPart.sort((a, b) => {
      const ta = a.best[phase] ?? Infinity;
      const tb = b.best[phase] ?? Infinity;
      return ta - tb || a.index - b.index;
    });
  }

  /** Time of the last car through to the next part (null in Q3 or while unknown). */
  cutoff(): number | null {
    if (this.phase === 2) return null;
    return this.standings()[this.keep - 1]?.best[this.phase] ?? null;
  }

  /** Advance one clock step and return the events it produced. */
  step(): QualiEvent[] {
    this.newEvents = [];
    if (this.state !== "running") return this.newEvents;
    this.applyCommands();
    this.clock += QUALI_DT;
    if (!this.flagShown && this.clock >= this.duration) {
      this.flagShown = true;
      this.emit({ type: "flag", phase: this.phase });
    }
    for (const car of this.active) {
      this.advanceCar(car);
      if (car.auto) this.aiDecide(car);
    }
    if (
      this.clock >= this.duration &&
      !this.active.some((c) => c.stage === "out" || c.stage === "push")
    )
      this.endPhase();
    return this.newEvents;
  }

  /** Start the next part after a break. */
  nextPhase(): void {
    if (this.state !== "break") return;
    this.phase++;
    this.clock = 0;
    this.flagShown = false;
    this.state = "running";
    for (const car of this.active) {
      car.stage = "garage";
      car.readyAt = 0;
      car.pushLeft = 0;
      if (car.auto) this.planRuns(car);
    }
  }

  /** Run the rest of qualifying to the end (AI for every car still on manual is idle). */
  run(): QualifyingResult[] {
    while (this.state !== "finished") {
      if (this.state === "break") this.nextPhase();
      else this.step();
    }
    return this.results();
  }

  /** Final order once qualifying is over, in the same shape as instant qualifying. */
  results(): QualifyingResult[] {
    const q3 = this.cars.filter((c) => c.eliminatedIn === null);
    const q2 = this.cars.filter((c) => c.eliminatedIn === 1);
    const q1 = this.cars.filter((c) => c.eliminatedIn === 0);
    const by = (phase: number) => (a: QualiCar, b: QualiCar) =>
      (a.best[phase] ?? Infinity) - (b.best[phase] ?? Infinity) ||
      (a.best[phase - 1] ?? Infinity) - (b.best[phase - 1] ?? Infinity) ||
      a.index - b.index;
    const order = [
      ...q3.sort(by(2)).map((c) => ({ c, reached: 3 as const })),
      ...q2.sort(by(1)).map((c) => ({ c, reached: 2 as const })),
      ...q1.sort(by(0)).map((c) => ({ c, reached: 1 as const })),
    ];
    return order.map(({ c, reached }, i) => ({
      position: i + 1,
      driverId: c.driverId,
      teamId: c.teamId,
      q1: c.best[0],
      q2: c.best[1],
      q3: c.best[2],
      reached,
    }));
  }

  /** The starting grid as driver ids. */
  grid(): string[] {
    return this.results().map((r) => r.driverId);
  }

  // ------------------------------------------------------------------ internals

  private emit(
    event: Omit<QualiEvent, "seq" | "phase" | "clock"> & Partial<QualiEvent>,
  ) {
    const full = {
      ...event,
      seq: this.events.length,
      phase: this.phase,
      clock: this.clock,
    } as QualiEvent;
    this.events.push(full);
    this.newEvents.push(full);
  }

  private applyCommands() {
    for (const command of this.queue) {
      if (command.type === "auto") {
        for (const car of this.cars) {
          if (!car.isPlayer || car.auto) continue;
          if (command.driverId && car.driverId !== command.driverId) continue;
          car.auto = true;
          this.planRuns(car);
        }
        continue;
      }
      const car = this.carByDriver(command.driverId);
      if (!car || car.eliminatedIn !== null) continue;
      if (command.type === "run")
        this.sendOut(car, command.tyre, command.pushLaps);
      else if (command.type === "abort" && car.stage !== "garage") {
        // Back to the pits: the lap in progress is abandoned.
        car.pushLeft = 0;
        this.pending[car.index] = null;
        this.startStage(car, "in", this.expectedLap(car) * IN_LAP * 0.6);
      }
    }
    this.queue = [];
  }

  /** Tyres the car can fit for a run now. */
  tyreOptions(car: QualiCar): QualiTyre[] {
    if (this.wet) return ["intermediate", "wet"];
    const options: QualiTyre[] = [];
    if (car.softSets > 0) options.push("soft-new");
    if (car.compound === "soft" && car.tyreAge > 0) options.push("soft-used");
    options.push("medium");
    return options;
  }

  /** Whether the car can leave the garage now. */
  canGo(car: QualiCar): boolean {
    return (
      this.state === "running" &&
      car.eliminatedIn === null &&
      car.stage === "garage" &&
      this.clock >= car.readyAt &&
      this.clock < this.duration
    );
  }

  private sendOut(car: QualiCar, tyre: QualiTyre, pushLaps: 1 | 2) {
    if (!this.canGo(car) || !this.tyreOptions(car).includes(tyre)) return;
    if (tyre === "soft-new") {
      car.softSets--;
      car.compound = "soft";
      car.tyreAge = 0;
    } else if (tyre === "medium") {
      if (car.compound !== "medium") car.tyreAge = 0;
      car.compound = "medium";
    } else if (tyre === "intermediate" || tyre === "wet") {
      car.compound = tyre;
      car.tyreAge = 0;
    }
    car.pushLeft = pushLaps;
    this.emit({ type: "run", car: car.index, tyre });
    this.startStage(car, "out", this.expectedLap(car) * OUT_LAP);
  }

  private startStage(car: QualiCar, stage: QualiCar["stage"], seconds: number) {
    car.stage = stage;
    car.stageStartedAt = this.clock;
    car.stageEndsAt = this.clock + seconds;
  }

  private advanceCar(car: QualiCar) {
    if (car.stage === "garage" || this.clock < car.stageEndsAt) return;
    if (car.stage === "out" || (car.stage === "push" && car.pushLeft > 0)) {
      if (car.stage === "push") this.finishLap(car);
      // A timed lap only counts if it starts before the flag.
      if (car.pushLeft > 0 && this.clock < this.duration) this.startLap(car);
      else this.startStage(car, "in", this.expectedLap(car) * IN_LAP);
      return;
    }
    if (car.stage === "push") {
      this.finishLap(car);
      this.startStage(car, "in", this.expectedLap(car) * IN_LAP);
      return;
    }
    // In-lap done: back in the garage for fresh tyres.
    car.stage = "garage";
    car.readyAt = this.clock + TYRE_CHANGE;
  }

  private startLap(car: QualiCar) {
    const driver = this.driverOf[car.index];
    const expected = this.expectedLap(car, car.compound, car.tyreAge);
    const sigma = lapNoiseSigma(driver, this.wetness) * 0.6;
    let time = expected + this.rng.normal(0, sigma);
    const traffic = this.rng.chance(this.trafficChance(car));
    if (traffic) time += this.rng.range(0.15, 0.8);
    const mistakeChance =
      (0.02 + (100 - driver.ratings.consistency) * 0.002) * (1 + this.wetness);
    const mistake = this.rng.chance(mistakeChance);
    if (mistake) time += this.rng.range(0.3, 1.5);
    const deleted = this.rng.chance(TRACK_LIMITS);
    this.pending[car.index] = {
      phase: this.phase,
      time: deleted ? null : time,
      compound: car.compound,
      mistake,
      traffic,
      deleted,
      clock: 0,
    };
    car.pushLeft--;
    this.startStage(car, "push", time);
  }

  private finishLap(car: QualiCar) {
    const lap = this.pending[car.index];
    this.pending[car.index] = null;
    if (!lap) return;
    lap.clock = this.clock;
    car.tyreAge++;
    car.laps.push(lap);
    const best = car.best[this.phase];
    if (lap.time !== null && (best === null || lap.time < best))
      car.best[this.phase] = lap.time;
    const position =
      car.best[this.phase] === null ? null : this.standings().indexOf(car) + 1;
    this.emit({ type: "lap", car: car.index, lap, position });
  }

  private endPhase() {
    const standings = this.standings();
    const eliminated: number[] = [];
    if (this.phase < 2) {
      for (const car of standings.slice(this.keep)) {
        car.eliminatedIn = this.phase;
        eliminated.push(car.index);
      }
    }
    for (const car of this.cars)
      if (car.stage !== "garage") car.stage = "garage";
    this.emit({ type: "phase-end", phase: this.phase, eliminated });
    if (this.phase === 2) {
      this.state = "finished";
      this.emit({ type: "finished" });
    } else {
      this.state = "break";
    }
  }

  // ------------------------------------------------------------------ AI

  /** Plan this part's runs: an early banker, then the decisive one at the end. */
  private planRuns(car: QualiCar) {
    const lap = this.expectedLap(car);
    const latest = this.duration - lap * OUT_LAP;
    const last = latest - this.rng.range(15, 70);
    const first = this.duration * this.rng.range(0.12, 0.4);
    car.plan = [first, last].filter((t) => t >= this.clock - 1 && t < latest);
    if (car.plan.length === 0 && this.clock < latest) car.plan = [this.clock];
  }

  private aiDecide(car: QualiCar) {
    if (!this.canGo(car) || car.plan.length === 0) return;
    if (this.clock < car.plan[0]) return;
    const isLast = car.plan.length === 1;
    car.plan.shift();
    // Safely through after the first run: save a set of tyres.
    if (isLast && this.phase < 2) {
      const position = this.standings().indexOf(car) + 1;
      if (
        car.best[this.phase] !== null &&
        position <= this.keep - 4 &&
        this.rng.chance(0.5)
      )
        return;
    }
    const options = this.tyreOptions(car);
    // Keep two new sets for Q3 if the car can get there.
    const saveForLater = this.phase < 2 && car.softSets <= 2 && !isLast;
    const tyre: QualiTyre = this.wet
      ? (idealCompoundFor(this.wetness) as QualiTyre)
      : options.includes("soft-new") && !saveForLater
        ? "soft-new"
        : options.includes("soft-used")
          ? "soft-used"
          : options[0];
    this.sendOut(car, tyre, 1);
  }
}

export function createQualifying(config: RaceConfig): QualiSession {
  return new QualiSession(config);
}
