import type { Track } from "@/data/types";
import type { WeatherMode } from "@/engine";

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
  seed: number;
};

export function raceQuery(p: RaceParams): string {
  return new URLSearchParams({
    track: p.trackId,
    team: p.teamId,
    laps: String(p.laps),
    weather: p.weather,
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
  autoPause: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  teamId: null,
  trackId: null,
  distance: "quarter",
  weather: "auto",
  autoPause: true,
};
