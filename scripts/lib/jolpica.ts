import { fetchCached } from "./http";

const BASE = "https://api.jolpi.ca/ergast/f1";

type Location = {
  lat: string;
  long: string;
  locality: string;
  country: string;
};
export type JCircuit = {
  circuitId: string;
  circuitName: string;
  Location: Location;
};
export type JDriver = {
  driverId: string;
  code?: string;
  permanentNumber?: string;
  givenName: string;
  familyName: string;
  dateOfBirth?: string;
  nationality?: string;
};
export type JConstructor = { constructorId: string; name: string };

export type JRace = {
  season: string;
  round: string;
  raceName: string;
  date: string;
  Circuit: JCircuit;
};

export type JResult = {
  position: string;
  grid: string;
  laps: string;
  status: string;
  Driver: JDriver;
  Constructor: JConstructor;
  FastestLap?: { Time?: { time: string } };
};

export type JQualifying = {
  position: string;
  Driver: JDriver;
  Constructor: JConstructor;
  Q1?: string;
  Q2?: string;
  Q3?: string;
};

export type JPitStop = { driverId: string; lap: string; duration: string };

type RaceTable<K extends string, T> = {
  MRData: { RaceTable: { Races: (JRace & Record<K, T[]>)[] } };
};

async function races(season: number): Promise<JRace[]> {
  const data = await fetchCached<RaceTable<never, never>>(
    `${BASE}/${season}/races/?limit=100`,
  );
  return data.MRData.RaceTable.Races;
}

async function roundTable<K extends string, T>(
  season: number,
  round: number,
  path: string,
  key: K,
) {
  const data = await fetchCached<RaceTable<K, T>>(
    `${BASE}/${season}/${round}/${path}/?limit=100`,
  );
  return data.MRData.RaceTable.Races[0]?.[key] ?? [];
}

export const jolpica = {
  races,
  results: (season: number, round: number) =>
    roundTable<"Results", JResult>(season, round, "results", "Results"),
  qualifying: (season: number, round: number) =>
    roundTable<"QualifyingResults", JQualifying>(
      season,
      round,
      "qualifying",
      "QualifyingResults",
    ),
  pitStops: (season: number, round: number) =>
    roundTable<"PitStops", JPitStop>(season, round, "pitstops", "PitStops"),

  async drivers(season: number): Promise<JDriver[]> {
    const data = await fetchCached<{
      MRData: { DriverTable: { Drivers: JDriver[] } };
    }>(`${BASE}/${season}/drivers/?limit=100`);
    return data.MRData.DriverTable.Drivers;
  },

  async driverStandings(season: number) {
    type S = {
      position: string;
      points: string;
      wins: string;
      Driver: JDriver;
    };
    const data = await fetchCached<{
      MRData: {
        StandingsTable: { StandingsLists: { DriverStandings: S[] }[] };
      };
    }>(`${BASE}/${season}/driverstandings/?limit=100`);
    return data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? [];
  },

  async constructorStandings(season: number) {
    type S = { position: string; points: string; Constructor: JConstructor };
    const data = await fetchCached<{
      MRData: {
        StandingsTable: { StandingsLists: { ConstructorStandings: S[] }[] };
      };
    }>(`${BASE}/${season}/constructorstandings/?limit=100`);
    return (
      data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? []
    );
  },
};

/** "1:23.456" or "83.456" -> seconds. */
export function parseLapTime(time: string | undefined): number | null {
  if (!time) return null;
  const parts = time.split(":");
  const secs =
    parts.length === 2
      ? Number(parts[0]) * 60 + Number(parts[1])
      : Number(parts[0]);
  return Number.isFinite(secs) && secs > 0 ? secs : null;
}
