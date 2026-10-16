import calendarJson from "./calendar.json";
import driversJson from "./drivers.json";
import metaJson from "./meta.json";
import teamsJson from "./teams.json";
import tracksJson from "./tracks.json";
import type { CalendarRound, Driver, Team, Track } from "./types";

export * from "./types";

export const teams = teamsJson as Team[];
export const drivers = driversJson as Driver[];
export const tracks = tracksJson as Track[];
export const calendar = calendarJson as CalendarRound[];
export const meta = metaJson as {
  season: number;
  generatedAt: string;
  lastCompletedRound: number;
};

const teamById = new Map(teams.map((t) => [t.id, t]));
const trackById = new Map(tracks.map((t) => [t.id, t]));

export function getTeam(id: string): Team {
  const team = teamById.get(id);
  if (!team) throw new Error(`Unknown team "${id}"`);
  return team;
}

export function getTrack(id: string): Track {
  const track = trackById.get(id);
  if (!track) throw new Error(`Unknown track "${id}"`);
  return track;
}

export function getTeamDrivers(teamId: string): Driver[] {
  return drivers.filter((d) => d.teamId === teamId);
}
