import { RaceView } from "@/components/race/race-view";
import { tracks } from "@/data";
import { parseRaceParams, withSeed } from "@/game/parse-params";
import { redirect } from "@/i18n/navigation";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";

export async function generateMetadata({
  searchParams,
}: PageProps<"/[locale]/race">): Promise<Metadata> {
  const { track } = await searchParams;
  const t = await getTranslations("tracks");
  const found = tracks.find((x) => x.id === track);
  return { title: found ? t(found.id as never) : "Race" };
}

/**
 * /race?track=monza&seed=123&team=mclaren&laps=20&weather=mixed
 * Without a seed it redirects to one, so every race can be shared and replayed.
 */
export default function RacePage({
  searchParams,
}: PageProps<"/[locale]/race">) {
  return (
    <Suspense fallback={<RaceLoading />}>
      <RaceFromParams searchParams={searchParams} />
    </Suspense>
  );
}

async function RaceFromParams({
  searchParams,
}: Pick<PageProps<"/[locale]/race">, "searchParams">) {
  const params = parseRaceParams(await searchParams);
  if (params.seed === null) {
    // A fresh seed per request: opt out of prerendering before using randomness.
    await connection();
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    redirect({
      href: `/race?${withSeed(params, seed)}`,
      locale: await getLocale(),
    });
  }
  const { trackId, teamId, laps, weather, difficulty, seed } = params;
  return (
    <RaceView
      key={`${trackId}-${seed}-${teamId}-${laps}-${weather}-${difficulty}`}
      setup={{
        trackId,
        seed: seed!,
        playerTeamId: teamId,
        laps,
        weather,
        difficulty,
      }}
    />
  );
}

async function RaceLoading() {
  const t = await getTranslations("race");
  return (
    <main className="grid min-h-dvh place-items-center">
      <p className="animate-pulse font-mono text-sm text-muted-foreground uppercase">
        {t("loading")}
      </p>
    </main>
  );
}
