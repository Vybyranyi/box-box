"use client";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { calendar, getTrack, meta, teams } from "@/data";
import { teamObjective, teamRanking } from "@/game/objective";
import {
  DEFAULT_SETTINGS,
  DIFFICULTIES,
  DISTANCES,
  lapsFor,
  newSeed,
  raceQuery,
  WEATHER_OPTIONS,
  type Settings,
} from "@/game/race-options";
import { Link, useRouter } from "@/i18n/navigation";
import { useMsg } from "@/i18n/use-msg";
import { useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Target } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("setup");
  const tTracks = useTranslations("tracks");
  const tCommon = useTranslations("common");
  const translate = useMsg();
  const router = useRouter();
  const [settings, setSettings] = useStored<Settings>(
    "settings",
    DEFAULT_SETTINGS,
  );
  const [step, setStep] = useState<1 | 2>(1);
  const update = (patch: Partial<Settings>) =>
    setSettings({ ...settings, ...patch });

  const team = teams.find((x) => x.id === settings.teamId) ?? null;
  const trackId = settings.trackId ?? nextRound.trackId;
  const track = getTrack(trackId);
  const trackName = tTracks(trackId as never);
  const laps = lapsFor(track, settings.distance);
  const difficulty = settings.difficulty ?? "normal";
  const objective = team
    ? teamObjective(teams, track, team.id, difficulty)
    : null;
  const trackRank = team
    ? teamRanking(teams, track).findIndex((x) => x.id === team.id) + 1
    : null;
  const weatherDetail = (id: Settings["weather"]) =>
    id === "auto"
      ? t("weathers.auto.detail", {
          risk: Math.round(track.rainProbability * 100),
        })
      : t(`weathers.${id}.detail`);

  const go = () => {
    if (!team) return;
    update({ trackId });
    router.push(
      `/qualifying?${raceQuery({ trackId, teamId: team.id, laps, weather: settings.weather, difficulty, seed: newSeed() })}`,
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
            {tCommon("back")}
          </Link>
          <h1 className="text-3xl font-black uppercase italic sm:text-4xl">
            {step === 1 ? t("chooseTeam") : t("chooseRace")}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <ol className="flex gap-2 font-mono text-xs uppercase">
            {[t("stepTeam"), t("stepRace")].map((label, i) => (
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
          <LocaleSwitcher />
        </div>
      </header>

      {step === 1 ? (
        <section
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          aria-label={t("chooseTeam")}
        >
          {[...teams]
            .sort((a, b) => overallRank.get(a.id)! - overallRank.get(b.id)!)
            .map((x) => (
              <TeamCard
                key={x.id}
                team={x}
                rank={overallRank.get(x.id)!}
                selected={x.id === settings.teamId}
                onSelect={() => update({ teamId: x.id })}
              />
            ))}
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
            aria-label={t("chooseRace")}
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
                {t("distance")}
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
                    <span className="block text-sm font-bold">
                      {t(`distances.${d.id}`)}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {d.id === "sprint"
                        ? t("sprintDetail")
                        : t("lapsCount", { laps: lapsFor(track, d.id) })}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {laps >= track.laps * 0.5
                  ? t("mandatoryStop")
                  : t("noMandatoryStop")}
              </p>
            </section>

            <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">
                {t("weather")}
              </h2>
              <div className="flex flex-col gap-1.5">
                {WEATHER_OPTIONS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => update({ weather: id })}
                    aria-pressed={settings.weather === id}
                    className={cn(
                      "flex items-baseline justify-between gap-2 rounded-lg border px-3 py-1.5 text-left transition-colors",
                      settings.weather === id
                        ? "border-primary bg-primary/10"
                        : "hover:bg-muted",
                    )}
                  >
                    <span className="text-sm font-semibold">
                      {t(`weathers.${id}.label`)}
                    </span>
                    <span className="text-right text-[11px] text-muted-foreground">
                      {weatherDetail(id)}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">
                {t("difficulty")}
              </h2>
              <div className="grid grid-cols-3 gap-1.5">
                {DIFFICULTIES.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => update({ difficulty: id })}
                    aria-pressed={difficulty === id}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-sm font-semibold transition-colors",
                      difficulty === id
                        ? "border-primary bg-primary/10"
                        : "hover:bg-muted",
                    )}
                  >
                    {t(`difficulties.${id}.label`)}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t(`difficulties.${difficulty}.detail`)}
              </p>
            </section>

            {objective && team && (
              <section
                className="flex flex-col gap-1 rounded-xl border bg-card p-4"
                style={{ borderLeftColor: team.color, borderLeftWidth: 4 }}
              >
                <h2 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                  <Target className="size-3.5" />{" "}
                  {t("objectiveAt", { track: trackName })}
                </h2>
                <p className="font-bold">{translate(objective.text)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t("carRank", { team: team.shortName, rank: trackRank! })}
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
              <ArrowLeft /> {t("back")}
            </Button>
          )}
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {team ? (
              <>
                <b className="text-foreground">{team.shortName}</b>
                {step === 2 && (
                  <>
                    {" · "}
                    {t("summary", {
                      track: trackName,
                      laps,
                      weather: t(`weathers.${settings.weather}.label`),
                    })}
                  </>
                )}
              </>
            ) : (
              t("pickTeam")
            )}
          </p>
          {step === 1 ? (
            <Button size="lg" disabled={!team} onClick={() => setStep(2)}>
              {t("next")} <ArrowRight />
            </Button>
          ) : (
            <Button size="lg" onClick={go} className="font-bold">
              {t("qualifying")} <ArrowRight />
            </Button>
          )}
        </div>
      </footer>
    </main>
  );
}
