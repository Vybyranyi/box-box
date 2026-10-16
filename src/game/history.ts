import type { WeatherMode } from "@/engine";
import { readStored, writeStored } from "@/lib/storage";
import type { Grade } from "./objective";

export const HISTORY_KEY = "history";
const MAX_ENTRIES = 30;

export type HistoryEntry = {
  id: string;
  date: string;
  trackId: string;
  teamId: string;
  laps: number;
  weather: WeatherMode;
  seed: number;
  grade: Grade;
  score: number;
  points: number;
  /** Message key of the team objective, e.g. "objective.podium". */
  objective: string;
  met: boolean;
  /** Finishing positions (or "DNF"/"DSQ") of the team's two cars. */
  finishes: { code: string; result: string }[];
};

export const EMPTY_HISTORY: HistoryEntry[] = [];

export function saveToHistory(entry: HistoryEntry): void {
  const list = readStored<HistoryEntry[]>(HISTORY_KEY, EMPTY_HISTORY);
  if (list.some((e) => e.id === entry.id)) return;
  writeStored(HISTORY_KEY, [entry, ...list].slice(0, MAX_ENTRIES));
}
