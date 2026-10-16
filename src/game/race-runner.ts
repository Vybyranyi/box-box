import {
  createRace,
  DT,
  type Race,
  type RaceConfig,
  type TimedEvent,
} from "@/engine";

export const SPEEDS = [1, 2, 4, 8, 16] as const;
export type Speed = (typeof SPEEDS)[number];

/** Longest real-time gap we catch up on in one frame (e.g. after the tab was hidden). */
const MAX_FRAME_SECONDS = 0.25;

/**
 * Drives a Race in real time: converts wall-clock time into fixed engine steps and keeps the
 * previous step's positions so the renderer can interpolate between them.
 */
export class RaceRunner {
  readonly race: Race;
  speed: Speed = 1;
  paused = false;
  private accumulator = 0;
  private prevLapDistance: number[];
  private prevLap: number[];
  private prevStatus: string[];
  private listeners = new Set<(events: TimedEvent[]) => void>();

  constructor(config: RaceConfig) {
    this.race = createRace(config);
    this.prevLapDistance = this.race.cars.map((c) => c.lapDistance);
    this.prevLap = this.race.cars.map((c) => c.lap);
    this.prevStatus = this.race.cars.map((c) => c.status);
  }

  setSpeed(speed: Speed) {
    this.speed = speed;
  }

  setPaused(paused: boolean) {
    this.paused = paused;
  }

  /** Subscribe to the events each step produces. Returns an unsubscribe function. */
  onEvents(listener: (events: TimedEvent[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Advance by `realSeconds` of wall-clock time; returns how many engine steps ran. */
  advance(realSeconds: number): number {
    if (this.paused || this.race.finished) return 0;
    this.accumulator += Math.min(realSeconds, MAX_FRAME_SECONDS) * this.speed;
    let steps = 0;
    // Re-check `paused` every step: a listener may pause the race mid-frame (auto-pause).
    while (this.accumulator >= DT && !this.race.finished && !this.paused) {
      this.snapshot();
      const events = this.race.step();
      if (events.length) for (const l of this.listeners) l(events);
      this.accumulator -= DT;
      steps++;
    }
    return steps;
  }

  /** Fraction of the way from the previous step to the current one, for interpolation. */
  get alpha(): number {
    return this.race.finished ? 1 : Math.min(1, this.accumulator / DT);
  }

  /** Interpolated distance along the lap for drawing, in metres (may exceed the lap length). */
  renderDistance(index: number): number {
    const car = this.race.cars[index];
    const prevStatus = this.prevStatus[index];
    if (prevStatus !== car.status) return car.lapDistance;
    let prev = this.prevLapDistance[index];
    const current = car.lapDistance;
    // Crossed the line between the two steps.
    if (
      car.lap > this.prevLap[index] ||
      current < prev - this.race.lapLength / 2
    )
      prev -= this.race.lapLength;
    return prev + (current - prev) * this.alpha;
  }

  private snapshot() {
    const cars = this.race.cars;
    for (let i = 0; i < cars.length; i++) {
      this.prevLapDistance[i] = cars[i].lapDistance;
      this.prevLap[i] = cars[i].lap;
      this.prevStatus[i] = cars[i].status;
    }
  }
}
