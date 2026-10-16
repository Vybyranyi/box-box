import type { Driver, Team, Track } from "@/data/types";

export type DryCompound = "soft" | "medium" | "hard";
export type WetCompound = "intermediate" | "wet";
export type Compound = DryCompound | WetCompound;

export type PaceMode = "push" | "balanced" | "conserve";

export type WeatherMode = "auto" | "dry" | "wet" | "mixed";

export type RaceConfig = {
  seed: number;
  track: Track;
  teams: Team[];
  drivers: Driver[];
  /** Race length in laps; defaults to the track's full distance. */
  laps?: number;
  weather?: WeatherMode;
  /** Starting order as driver ids; if omitted, qualifying is simulated. */
  grid?: string[];
  /** Team whose two cars the player runs: the AI makes no strategy calls for them. */
  playerTeamId?: string | null;
  /** Starting tyre per driver id (player cars); AI cars choose their own. */
  startingTyres?: Record<string, Compound>;
  /** Dry races must use two different dry compounds; defaults to on for races of at least half distance. */
  requireTwoCompounds?: boolean;
};

export type CarStatus = "racing" | "pit" | "retired" | "finished";

export type TyreState = {
  compound: Compound;
  /** 0..100 %. */
  wear: number;
  /** Laps completed on this set. */
  age: number;
};

export type Stint = {
  compound: Compound;
  startLap: number;
  endLap: number | null;
};

export type PitStopRecord = {
  lap: number;
  from: Compound;
  to: Compound;
  stationarySeconds: number;
  underSafetyCar: boolean;
};

export type StrategyPlan = {
  /** Planned stints for the rest of the race: compound and the lap it ends on. */
  stints: { compound: DryCompound; endLap: number }[];
};

export type CarState = {
  index: number;
  driverId: string;
  teamId: string;
  code: string;
  isPlayer: boolean;
  status: CarStatus;
  retiredReason: "crash" | "mechanical" | null;

  /** Completed laps. */
  lap: number;
  /** Metres since the start/finish line on the current lap (negative on the grid). */
  lapDistance: number;
  /** Current speed in m/s. */
  speed: number;

  tyre: TyreState;
  usedCompounds: Compound[];
  stints: Stint[];
  fuelKg: number;
  paceMode: PaceMode;

  /** Target lap time for the current lap, before traffic effects. */
  lapTimeTarget: number;
  lapStartTime: number;
  lastLapTime: number | null;
  bestLapTime: number | null;
  lapTimes: number[];

  /** Set while the player or AI has called the car in: compound to fit at the next stop. */
  pitRequest: Compound | null;
  /** Seconds left in the pit lane while status is "pit". */
  pitTimeLeft: number;
  pitStops: PitStopRecord[];
  /** First lap after a stop, tyres are cold. */
  outLap: boolean;
  /** Puncture: the car crawls to the pits. */
  punctured: boolean;

  /** Lap distance at which an incident will happen on this lap, if any. */
  incidentAt: { distance: number; kind: "crash" | "mechanical" } | null;
  /** Lap on which a mechanical failure is due (rolled at the start), if any. */
  failureLap: number | null;

  /** Overtake in progress: the car being passed. */
  passing: { targetIndex: number; until: number } | null;

  position: number;
  gridPosition: number;
  /** Seconds behind the leader; null if not yet timed. */
  gapToLeader: number | null;
  /** Seconds to the car ahead in the classification; null for the leader. */
  interval: number | null;
  /** Laps behind the leader. */
  lapsDown: number;
  finishTime: number | null;
  disqualified: boolean;

  /** AI-only strategy state. */
  ai: {
    plan: StrategyPlan;
    /** Lap the AI will actually stop on for the current stint (plan ± jitter). */
    nextStopLap: number | null;
    /** Laps of delay in reacting to changing weather. */
    weatherReaction: number;
    /** Consecutive laps the weather has called for a different tyre. */
    weatherMismatchLaps: number;
  } | null;
};

export type TrackStatus = "green" | "sc" | "vsc";

export type SafetyCarState = {
  status: TrackStatus;
  /** Leader lap on which the Safety Car comes in (SC). */
  endsOnLap: number | null;
  /** Race time at which the VSC ends. */
  endsAt: number | null;
  deployments: { type: "sc" | "vsc"; lap: number }[];
};

export type WeatherKeyframe = { time: number; rain: number };

export type WeatherState = {
  /** Rain intensity keyframes over race time, 0..1. */
  timeline: WeatherKeyframe[];
  rain: number;
  /** Track wetness, 0 (dry) .. 1 (soaked). */
  wetness: number;
};

export type TeamOrder = "free" | "hold" | "swap";

export type RaceEvent =
  | { type: "start" }
  | { type: "lap"; lap: number }
  | { type: "overtake"; car: number; on: number }
  | { type: "pit-entry"; car: number; compound: Compound }
  | { type: "pit-exit"; car: number; stationarySeconds: number; slow: boolean }
  | { type: "sc-deployed" }
  | { type: "sc-ending" }
  | { type: "vsc-deployed" }
  | { type: "vsc-ending" }
  | { type: "green" }
  | { type: "rain-start" }
  | { type: "rain-stop" }
  | { type: "crash"; car: number }
  | { type: "mechanical"; car: number }
  | { type: "puncture"; car: number }
  | { type: "tyre-warning"; car: number; wear: number }
  | { type: "fastest-lap"; car: number; time: number }
  | { type: "team-order"; teamId: string; order: TeamOrder }
  | { type: "chequered-flag" }
  | { type: "finished"; car: number; position: number }
  | { type: "disqualified"; car: number; reason: string };

export type TimedEvent = { time: number; lap: number } & RaceEvent;

export type RaceCommand =
  | { type: "pit"; driverId: string; compound: Compound }
  | { type: "cancel-pit"; driverId: string }
  | { type: "pace"; driverId: string; mode: PaceMode }
  | { type: "team-order"; teamId: string; order: TeamOrder };

export type ClassifiedResult = {
  position: number;
  driverId: string;
  teamId: string;
  code: string;
  status: "finished" | "lapped" | "dnf" | "dsq";
  laps: number;
  /** Seconds behind the winner for cars on the lead lap. */
  gap: number | null;
  totalTime: number | null;
  bestLap: number | null;
  pitStops: number;
  points: number;
  gridPosition: number;
};

export type QualifyingResult = {
  position: number;
  driverId: string;
  teamId: string;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  /** Session the driver was eliminated in, or 3 for the top ten. */
  reached: 1 | 2 | 3;
};
