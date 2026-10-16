import { DriverPortrait } from "@/components/driver-portrait";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { TrackOutline } from "@/components/track-outline";
import { buttonVariants } from "@/components/ui/button";
import { drivers, teams, tracks } from "@/data";
import { createRace, idealCompoundFor } from "@/engine";
import { translate, type Translate } from "@/game/messages";
import { teamObjective } from "@/game/objective";
import { parseRaceParams, withSeed } from "@/game/parse-params";
import { Link, redirect } from "@/i18n/navigation";
import { formatLapTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowRight, Target } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";

export async function generateMetadata({
  searchParams,
}: PageProps<"/[locale]/qualifying">): Promise<Metadata> {
  const { track } = await searchParams;
  const [t, tTracks] = await Promise.all([
    getTranslations("meta"),
    getTranslations("tracks"),
  ]);
  const found = tracks.find((x) => x.id === track);
  return {
    title: t("qualifying", { track: found ? tTracks(found.id as never) : "" }),
  };
}

export default function QualifyingPage({
  searchParams,
}: PageProps<"/[locale]/qualifying">) {
  return (
    <Suspense fallback={<Loading />}>
      <Qualifying searchParams={searchParams} />
    </Suspense>
  );
}

async function Loading() {
  const t = await getTranslations("qualifying");
  return (
    <main className="grid min-h-dvh place-items-center font-mono text-sm text-muted-foreground uppercase">
      {t("loading")}
    </main>
  );
}

async function Qualifying({
  searchParams,
}: Pick<PageProps<"/[locale]/qualifying">, "searchParams">) {
  const params = parseRaceParams(await searchParams);
  if (params.seed === null) {
    await connection();
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    redirect({
      href: `/qualifying?${withSeed(params, seed)}`,
      locale: await getLocale(),
    });
  }
  const seed = params.seed!;
  const [t, all] = await Promise.all([
    getTranslations("qualifying"),
    getTranslations(),
  ]);
  const tr = (key: Parameters<typeof translate>[1]) =>
    translate(all as unknown as Translate, key);

  // The race page builds the same race from the same seed, so this grid is the real one.
  const race = createRace({
    seed,
    track: tracks.find((x) => x.id === params.trackId)!,
    teams,
    drivers,
    laps: params.laps,
    weather: params.weather,
    playerTeamId: params.teamId,
  });
  const results = race.qualifying!;
  const team = teams.find((x) => x.id === params.teamId) ?? null;
  const objective = team ? teamObjective(teams, race.track, team.id) : null;
  const pole = results[0].q3 ?? results[0].q2 ?? results[0].q1!;
  const wet = idealCompoundFor(race.weather.wetness) !== "dry";
  const own = results.filter((r) => r.teamId === params.teamId);
  const query = withSeed(params, seed);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/play"
            className="font-mono text-xs text-muted-foreground uppercase hover:text-foreground"
          >
            {t("changeSetup")}
          </Link>
          <h1 className="text-3xl font-black uppercase italic sm:text-4xl">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("session", {
              circuit: race.track.circuitName,
              laps: race.laps,
              wet: String(wet),
            })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <TrackOutline
            track={race.track}
            className="h-20 w-28 text-foreground/70"
          />
          <LocaleSwitcher query={query} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section
          className="overflow-x-auto rounded-xl border bg-card"
          aria-label={t("tableLabel")}
        >
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="border-b text-left text-[11px] text-muted-foreground uppercase">
              <tr>
                <th className="w-10 px-3 py-2 text-right">{t("pos")}</th>
                <th className="px-2 py-2">{t("driver")}</th>
                <th className="px-2 py-2 text-right">Q1</th>
                <th className="px-2 py-2 text-right">Q2</th>
                <th className="px-2 py-2 text-right">Q3</th>
                <th className="px-3 py-2 text-right">{t("gap")}</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {results.map((r) => {
                const driver = drivers.find((d) => d.id === r.driverId)!;
                const rowTeam = teams.find((x) => x.id === r.teamId)!;
                const best =
                  r.reached === 3 ? r.q3 : r.reached === 2 ? r.q2 : r.q1;
                const mine = r.teamId === params.teamId;
                return (
                  <tr
                    key={r.driverId}
                    className={cn(
                      "border-b border-border/50 last:border-0",
                      mine && "bg-primary/10",
                      (r.position === 11 || r.position === 17) &&
                        "border-t-2 border-t-muted-foreground/30",
                    )}
                  >
                    <td className="px-3 py-1.5 text-right font-bold">
                      {r.position}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="flex items-center gap-2 font-sans">
                        <span
                          className="h-4 w-1 rounded-full"
                          style={{ background: rowTeam.color }}
                        />
                        <b className="font-mono">{driver.code}</b>
                        <span className="hidden text-muted-foreground sm:inline">
                          {driver.lastName}
                        </span>
                      </span>
                    </td>
                    {[r.q1, r.q2, r.q3].map((q, i) => (
                      <td
                        key={i}
                        className={cn(
                          "px-2 py-1.5 text-right",
                          q === best
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {q === null ? "" : formatLapTime(q)}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right text-muted-foreground">
                      {r.position === 1
                        ? t("pole")
                        : best !== null
                          ? `+${(best - pole).toFixed(3)}`
                          : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <aside className="flex flex-col gap-4">
          {team && objective && (
            <section
              className="flex flex-col gap-3 rounded-xl border bg-card p-4"
              style={{ borderTopColor: team.color, borderTopWidth: 4 }}
            >
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">
                {t("onGrid", { team: team.shortName })}
              </h2>
              {own.map((r) => {
                const driver = drivers.find((d) => d.id === r.driverId)!;
                return (
                  <div key={r.driverId} className="flex items-center gap-3">
                    <DriverPortrait
                      driver={driver}
                      team={team}
                      className="size-11"
                    />
                    <p className="flex-1 font-semibold">{driver.lastName}</p>
                    <span className="font-mono text-2xl font-black">
                      P{r.position}
                    </span>
                  </div>
                );
              })}
              <div className="rounded-lg bg-muted p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
                  <Target className="size-3.5" /> {t("objective")}
                </p>
                <p className="font-bold">{tr(objective.text)}</p>
              </div>
            </section>
          )}
          <Link
            href={`/race?${query}`}
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 font-bold uppercase",
            )}
          >
            {t("toGrid")} <ArrowRight />
          </Link>
        </aside>
      </div>
    </main>
  );
}
