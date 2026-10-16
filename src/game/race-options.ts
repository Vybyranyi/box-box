import type { Track } from "@/data/types";
import type { Difficulty, WeatherMode } from "@/engine";

/** Race distances; labels live in messages (setup.distances.*). */
export const DISTANCES = [
  { id: "sprint", share: null },
  { id: "quarter", share: 0.25 },
  { id: "half", share: 0.5 },
  { id: "full", share: 1 },
] as const;
export type DistanceId = (typeof DISTANCES)[number]["id"];

/** Weather modes offered in setup; labels live in messages (setup.weathers.*). */
export const WEATHER_OPTIONS: WeatherMode[] = ["auto", "dry", "mixed", "wet"];

/** Qualifying: run it yourself, or have it simulated instantly. */
export type QualifyingMode = "manual" | "auto";
export const QUALIFYING_MODES: QualifyingMode[] = ["manual", "auto"];

/** Difficulty levels offered in setup; labels live in messages (setup.difficulties.*). */
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

export function lapsFor(track: Track, distance: DistanceId): number {
  const option = DISTANCES.find((d) => d.id === distance)!;
  if (option.share === null) return Math.min(10, track.laps);
  return Math.max(5, Math.round(track.laps * option.share));
}

export type RaceParams = {
  trackId: string;
  teamId: string;
  laps: number;
  weather: WeatherMode;
  difficulty: Difficulty;
  qualifying: QualifyingMode;
  seed: number;
};

export function raceQuery(p: RaceParams): string {
  return new URLSearchParams({
    track: p.trackId,
    team: p.teamId,
    laps: String(p.laps),
    weather: p.weather,
    difficulty: p.difficulty,
    quali: p.qualifying,
    seed: String(p.seed),
  }).toString();
}

/** A fresh race seed. Call from event handlers, never during render. */
export function newSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
}

export type Settings = {
  teamId: string | null;
  trackId: string | null;
  distance: DistanceId;
  weather: WeatherMode;
  /** Missing in settings saved before difficulty levels existed. */
  difficulty?: Difficulty;
  /** Missing in settings saved before playable qualifying existed. */
  qualifying?: QualifyingMode;
  autoPause: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  teamId: null,
  trackId: null,
  distance: "quarter",
  weather: "auto",
  difficulty: "normal",
  qualifying: "manual",
  autoPause: true,
};
