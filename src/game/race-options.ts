import type { Track } from "@/data/types";
import type { WeatherMode } from "@/engine";

export const DISTANCES = [
  { id: "sprint", label: "Sprint", detail: "10 laps", share: null },
  { id: "quarter", label: "25%", detail: "Quarter distance", share: 0.25 },
  { id: "half", label: "50%", detail: "Half distance", share: 0.5 },
  { id: "full", label: "Full", detail: "Full Grand Prix", share: 1 },
] as const;
export type DistanceId = (typeof DISTANCES)[number]["id"];

export const WEATHER_OPTIONS: {
  id: WeatherMode;
  label: string;
  detail: string;
}[] = [
  { id: "auto", label: "Realistic", detail: "Based on the circuit's climate" },
  { id: "dry", label: "Dry", detail: "No rain" },
  {
    id: "mixed",
    label: "Changeable",
    detail: "Rain arrives or clears mid-race",
  },
  { id: "wet", label: "Wet", detail: "Rain all race" },
];

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
