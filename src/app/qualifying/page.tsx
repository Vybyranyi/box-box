import { DriverPortrait } from "@/components/driver-portrait";
import { TrackOutline } from "@/components/track-outline";
import { buttonVariants } from "@/components/ui/button";
import { drivers, teams, tracks } from "@/data";
import { createRace, idealCompoundFor } from "@/engine";
import { teamObjective } from "@/game/objective";
import { parseRaceParams, withSeed } from "@/game/parse-params";
import { formatLapTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowRight, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

export async function generateMetadata({
  searchParams,
}: PageProps<"/qualifying">): Promise<Metadata> {
  const { track } = await searchParams;
  const found = tracks.find((t) => t.id === track);
  return { title: `Qualifying · ${found?.name ?? ""} · Box Box` };
}

export default function QualifyingPage({
  searchParams,
}: PageProps<"/qualifying">) {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-dvh place-items-center font-mono text-sm text-muted-foreground uppercase">
          Qualifying in progress…
        </main>
      }
    >
      <Qualifying searchParams={searchParams} />
    </Suspense>
  );
}

async function Qualifying({
  searchParams,
}: Pick<PageProps<"/qualifying">, "searchParams">) {
  const params = parseRaceParams(await searchParams);
  if (params.seed === null) {
    await connection();
    redirect(
      `/qualifying?${withSeed(params, crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000)}`,
    );
  }
  // The race page builds the same race from the same seed, so this grid is the real one.
  const race = createRace({
    seed: params.seed,
    track: tracks.find((t) => t.id === params.trackId)!,
    teams,
    drivers,
    laps: params.laps,
    weather: params.weather,
    playerTeamId: params.teamId,
  });
  const results = race.qualifying!;
  const team = teams.find((t) => t.id === params.teamId) ?? null;
  const objective = team ? teamObjective(teams, race.track, team.id) : null;
  const pole = results[0].q3 ?? results[0].q2 ?? results[0].q1!;
  const wet = idealCompoundFor(race.weather.wetness) !== "dry";
  const own = results.filter((r) => r.teamId === params.teamId);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/play"
            className="font-mono text-xs text-muted-foreground uppercase hover:text-foreground"
          >
            ← Change setup
          </Link>
          <h1 className="text-3xl font-black uppercase italic sm:text-4xl">
            Qualifying
          </h1>
          <p className="text-sm text-muted-foreground">
            {race.track.circuitName} · {race.laps} laps ·{" "}
            {wet ? "wet session" : "dry session"}
          </p>
        </div>
        <TrackOutline
          track={race.track}
          className="h-20 w-28 text-foreground/70"
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section
          className="overflow-x-auto rounded-xl border bg-card"
          aria-label="Qualifying classification"
        >
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="border-b text-left text-[11px] text-muted-foreground uppercase">
              <tr>
                <th className="w-10 px-3 py-2 text-right">Pos</th>
                <th className="px-2 py-2">Driver</th>
                <th className="px-2 py-2 text-right">Q1</th>
                <th className="px-2 py-2 text-right">Q2</th>
                <th className="px-2 py-2 text-right">Q3</th>
                <th className="px-3 py-2 text-right">Gap</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {results.map((r) => {
                const driver = drivers.find((d) => d.id === r.driverId)!;
                const t = teams.find((x) => x.id === r.teamId)!;
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
                          style={{ background: t.color }}
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
                        ? "POLE"
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
                {team.shortName} on the grid
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
                  <Target className="size-3.5" /> Objective
                </p>
                <p className="font-bold">{objective.text}</p>
              </div>
            </section>
          )}
          <Link
            href={`/race?${withSeed(params, params.seed)}`}
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 font-bold uppercase",
            )}
          >
            To the grid <ArrowRight />
          </Link>
        </aside>
      </div>
    </main>
  );
}
