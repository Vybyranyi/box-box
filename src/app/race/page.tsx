import { RaceView } from "@/components/race/race-view";
import { tracks } from "@/data";
import { parseRaceParams, withSeed } from "@/game/parse-params";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

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
  const params = parseRaceParams(await searchParams);
  if (params.seed === null) {
    // A fresh seed per request: opt out of prerendering before using randomness.
    await connection();
    redirect(
      `/race?${withSeed(params, crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000)}`,
    );
  }
  const { trackId, teamId, laps, weather, seed } = params;
  return (
    <RaceView
      key={`${trackId}-${seed}-${teamId}-${laps}-${weather}`}
      setup={{ trackId, seed, playerTeamId: teamId, laps, weather }}
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
