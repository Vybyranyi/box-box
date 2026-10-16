import { getTrack, teams, tracks } from "@/data";
import type { Difficulty, WeatherMode } from "@/engine";
import { DIFFICULTIES } from "./race-options";

const WEATHER: WeatherMode[] = ["auto", "dry", "wet", "mixed"];

type SearchParams = Record<string, string | string[] | undefined>;

export type ParsedRaceParams = {
  trackId: string;
  teamId: string | null;
  weather: WeatherMode;
  difficulty: Difficulty;
  laps: number | undefined;
  /** Null when missing or invalid: the page should redirect with a fresh one. */
  seed: number | null;
};

/** Validate /race and /qualifying query parameters, falling back to safe defaults. */
export function parseRaceParams(params: SearchParams): ParsedRaceParams {
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;
  const trackId = tracks.some((t) => t.id === str(params.track))
    ? str(params.track)!
    : "monza";
  const teamId = teams.some((t) => t.id === str(params.team))
    ? str(params.team)!
    : null;
  const weatherParam = str(params.weather) as WeatherMode;
  const weather = WEATHER.includes(weatherParam) ? weatherParam : "auto";
  const lapsParam = Number(str(params.laps));
  const laps =
    Number.isInteger(lapsParam) && lapsParam > 0
      ? Math.min(lapsParam, getTrack(trackId).laps)
      : undefined;
  const difficultyParam = str(params.difficulty) as Difficulty;
  const difficulty = DIFFICULTIES.includes(difficultyParam)
    ? difficultyParam
    : "normal";
  const seedParam = Number(str(params.seed));
  const seed = Number.isInteger(seedParam) && seedParam >= 0 ? seedParam : null;
  return { trackId, teamId, weather, difficulty, laps, seed };
}

/** Query string for the same race with a given seed. */
export function withSeed(p: ParsedRaceParams, seed: number): string {
  const query = new URLSearchParams({
    track: p.trackId,
    weather: p.weather,
    difficulty: p.difficulty,
    seed: String(seed),
  });
  if (p.teamId) query.set("team", p.teamId);
  if (p.laps) query.set("laps", String(p.laps));
  return query.toString();
}
