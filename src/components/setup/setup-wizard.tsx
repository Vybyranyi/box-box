"use client";

import { Button } from "@/components/ui/button";
import { calendar, getTrack, meta, teams } from "@/data";
import { teamObjective, teamRanking } from "@/game/objective";
import {
  DEFAULT_SETTINGS,
  DISTANCES,
  lapsFor,
  newSeed,
  raceQuery,
  WEATHER_OPTIONS,
  type Settings,
} from "@/game/race-options";
import { useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TeamCard } from "./team-card";
import { TrackCard } from "./track-card";

/** Overall car order across the season, for the team tiers. */
const overallRank = new Map(
  [...teams]
    .sort((a, b) => a.car.paceDeficitPct - b.car.paceDeficitPct)
    .map((t, i) => [t.id, i + 1]),
);
const nextRound =
  calendar.find((r) => r.round > meta.lastCompletedRound) ?? calendar[0];

export function SetupWizard() {
  const router = useRouter();
  const [settings, setSettings] = useStored<Settings>(
    "settings",
    DEFAULT_SETTINGS,
  );
  const [step, setStep] = useState<1 | 2>(1);
  const update = (patch: Partial<Settings>) =>
    setSettings({ ...settings, ...patch });

  const team = teams.find((t) => t.id === settings.teamId) ?? null;
  const trackId = settings.trackId ?? nextRound.trackId;
  const track = getTrack(trackId);
  const laps = lapsFor(track, settings.distance);
  const objective = team ? teamObjective(teams, track, team.id) : null;
  const trackRank = team
    ? teamRanking(teams, track).findIndex((t) => t.id === team.id) + 1
    : null;

  const go = () => {
    if (!team) return;
    update({ trackId });
    router.push(
      `/qualifying?${raceQuery({ trackId, teamId: team.id, laps, weather: settings.weather, seed: newSeed() })}`,
    );
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 pb-28 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/"
            className="font-mono text-xs text-muted-foreground uppercase hover:text-foreground"
          >
            ← Box Box
          </Link>
          <h1 className="text-3xl font-black uppercase italic sm:text-4xl">
            {step === 1 ? "Choose your team" : "Choose the race"}
          </h1>
        </div>
        <ol className="flex gap-2 font-mono text-xs uppercase">
          {["Team", "Race"].map((label, i) => (
            <li
              key={label}
              className={cn(
                "rounded-md px-2 py-1",
                step === i + 1
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>
      </header>

      {step === 1 ? (
        <section
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          aria-label="Teams"
        >
          {[...teams]
            .sort((a, b) => overallRank.get(a.id)! - overallRank.get(b.id)!)
            .map((t) => (
              <TeamCard
                key={t.id}
                team={t}
                rank={overallRank.get(t.id)!}
                selected={t.id === settings.teamId}
                onSelect={() => update({ teamId: t.id })}
              />
            ))}
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
            aria-label="Circuits"
          >
            {calendar.map((round) => (
              <TrackCard
                key={round.round}
                track={getTrack(round.trackId)}
                round={round}
                status={
                  round.round <= meta.lastCompletedRound
                    ? "raced"
                    : round.round === nextRound.round
                      ? "next"
                      : "upcoming"
                }
                selected={round.trackId === trackId}
                onSelect={() => update({ trackId: round.trackId })}
              />
            ))}
          </section>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">
                Distance
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {DISTANCES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => update({ distance: d.id })}
                    aria-pressed={settings.distance === d.id}
                    className={cn(
                      "rounded-lg border p-2 text-left transition-colors",
                      settings.distance === d.id
                        ? "border-primary bg-primary/10"
                        : "hover:bg-muted",
                    )}
                  >
                    <span className="block text-sm font-bold">{d.label}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {d.id === "sprint"
                        ? d.detail
                        : `${lapsFor(track, d.id)} laps`}
                    </span>
                  </button>
                ))}
              </div>
              {laps >= track.laps * 0.5 ? (
                <p className="text-[11px] text-muted-foreground">
                  Mandatory stop: two dry compounds must be used.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  No mandatory stop at this distance.
                </p>
              )}
            </section>

            <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">
                Weather
              </h2>
              <div className="flex flex-col gap-1.5">
                {WEATHER_OPTIONS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => update({ weather: w.id })}
                    aria-pressed={settings.weather === w.id}
                    className={cn(
                      "flex items-baseline justify-between gap-2 rounded-lg border px-3 py-1.5 text-left transition-colors",
                      settings.weather === w.id
                        ? "border-primary bg-primary/10"
                        : "hover:bg-muted",
                    )}
                  >
                    <span className="text-sm font-semibold">{w.label}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {w.id === "auto"
                        ? `${Math.round(track.rainProbability * 100)}% rain risk`
                        : w.detail}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {objective && team && (
              <section
                className="flex flex-col gap-1 rounded-xl border bg-card p-4"
                style={{ borderLeftColor: team.color, borderLeftWidth: 4 }}
              >
                <h2 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                  <Target className="size-3.5" /> Team objective at {track.name}
                </h2>
                <p className="font-bold">{objective.text}</p>
                <p className="text-[11px] text-muted-foreground">
                  {team.shortName} has the {ordinal(trackRank!)} fastest car on
                  this kind of track.
                </p>
              </section>
            )}
          </aside>
        </div>
      )}

      <footer className="fixed inset-x-0 bottom-0 border-t bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          {step === 2 && (
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft /> Team
            </Button>
          )}
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {team ? (
              <>
                <b className="text-foreground">{team.shortName}</b>
                {step === 2 && (
                  <>
                    {" "}
                    · {track.name} · {laps} laps ·{" "}
                    {
                      WEATHER_OPTIONS.find((w) => w.id === settings.weather)!
                        .label
                    }
                  </>
                )}
              </>
            ) : (
              "Pick the team you'll run from the pit wall"
            )}
          </p>
          {step === 1 ? (
            <Button size="lg" disabled={!team} onClick={() => setStep(2)}>
              Next <ArrowRight />
            </Button>
          ) : (
            <Button size="lg" onClick={go} className="font-bold">
              Qualifying <ArrowRight />
            </Button>
          )}
        </div>
      </footer>
    </main>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
