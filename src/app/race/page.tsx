import { RaceView } from "@/components/race/race-view";
import { getTrack, teams, tracks } from "@/data";
import type { WeatherMode } from "@/engine";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

const WEATHER: WeatherMode[] = ["auto", "dry", "wet", "mixed"];

export async function generateMetadata({
  searchParams,
}: PageProps<"/race">): Promise<Metadata> {
  const { track } = await searchParams;
  const found = tracks.find((t) => t.id === track);
  return { title: `${found?.name ?? "Race"} · Box Box` };
}

/**
 * /race?track=monza&seed=123&team=mclaren&laps=20&weather=mixed
 * Without a seed it redirects to one, so every race can be shared and replayed.
 */
export default function RacePage({ searchParams }: PageProps<"/race">) {
  return (
    <Suspense fallback={<RaceLoading />}>
      <RaceFromParams searchParams={searchParams} />
    </Suspense>
  );
}

async function RaceFromParams({
  searchParams,
}: Pick<PageProps<"/race">, "searchParams">) {
  const params = await searchParams;
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;

  const trackId = tracks.some((t) => t.id === str(params.track))
    ? str(params.track)!
    : "monza";
  const team = teams.some((t) => t.id === str(params.team))
    ? str(params.team)!
    : null;
  const weather = WEATHER.includes(str(params.weather) as WeatherMode)
    ? (str(params.weather) as WeatherMode)
    : "auto";
  const lapsParam = Number(str(params.laps));
  const laps =
    Number.isInteger(lapsParam) && lapsParam > 0
      ? Math.min(lapsParam, getTrack(trackId).laps)
      : undefined;
  const seed = Number(str(params.seed));

  if (!Number.isInteger(seed) || seed < 0) {
    // A fresh seed per request: opt out of prerendering before using randomness.
    await connection();
    const query = new URLSearchParams({
      track: trackId,
      weather,
      seed: String(randomSeed()),
    });
    if (team) query.set("team", team);
    if (laps) query.set("laps", String(laps));
    redirect(`/race?${query}`);
  }

  return (
    <RaceView
      key={`${trackId}-${seed}-${team}-${laps}-${weather}`}
      setup={{ trackId, seed, playerTeamId: team, laps, weather }}
    />
  );
}

function RaceLoading() {
  return (
    <main className="grid min-h-dvh place-items-center">
      <p className="animate-pulse font-mono text-sm text-muted-foreground uppercase">
        Warming up the tyres…
      </p>
    </main>
  );
}

function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
}
