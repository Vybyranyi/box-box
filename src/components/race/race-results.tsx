"use client";

import { DriverPortrait } from "@/components/driver-portrait";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Race } from "@/engine";
import { gradeRace, type Grade } from "@/game/objective";
import { newSeed, raceQuery } from "@/game/race-options";
import { formatGap, formatLapTime, formatRaceTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Check, RotateCcw, Settings2, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useMsg } from "@/i18n/use-msg";
import { useTranslations } from "next-intl";
import { TyreBadge } from "./tyre-badge";

const GRADE_STYLE: Record<Grade, string> = {
  S: "text-amber-300",
  A: "text-emerald-400",
  B: "text-sky-400",
  C: "text-orange-400",
  D: "text-red-400",
};

/** Full-screen results after the chequered flag. */
export function RaceResults({
  race,
  teamId,
  onClose,
}: {
  race: Race;
  teamId: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("results");
  const translate = useMsg();
  const router = useRouter();
  const report = teamId ? gradeRace(race, teamId) : null;
  const results = race.classification();
  const winner = results[0];
  const fastest = race.fastestLap;

  const again = () => {
    if (!teamId) return;
    router.push(
      `/qualifying?${raceQuery({ trackId: race.track.id, teamId, laps: race.laps, weather: race.config.weather ?? "auto", seed: newSeed() })}`,
    );
  };

  return (
    <div
      className="fixed inset-0 z-30 overflow-y-auto bg-background/95 backdrop-blur"
      role="dialog"
      aria-label={t("title")}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-muted-foreground uppercase">
              {t("subtitle", {
                circuit: race.track.circuitName,
                laps: race.laps,
                time: winner.totalTime ? formatRaceTime(winner.totalTime) : "",
              })}
            </p>
            <h1 className="text-3xl font-black uppercase italic sm:text-4xl">
              {t("title")}
            </h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t("close")}
          >
            <X />
          </Button>
        </header>

        {report && (
          <section className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)]">
            <div className="flex flex-col items-center justify-center rounded-2xl border bg-card px-10 py-6">
              <span
                className={cn(
                  "text-8xl leading-none font-black italic",
                  GRADE_STYLE[report.grade],
                )}
              >
                {report.grade}
              </span>
              <span className="mt-1 font-mono text-sm text-muted-foreground">
                {t("score", { score: report.score })}
              </span>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
              <p className="text-lg font-semibold">
                {t(`grade.${report.grade}`)}
              </p>
              <p
                className={cn(
                  "flex items-center gap-2 font-semibold",
                  report.met ? "text-emerald-400" : "text-red-400",
                )}
              >
                {report.met ? (
                  <Check className="size-4" />
                ) : (
                  <X className="size-4" />
                )}
                {t("objective", {
                  objective: translate(report.objective.text),
                })}
              </p>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {report.breakdown.map((b) => (
                  <li
                    key={b.label.key}
                    className="flex justify-between rounded bg-muted px-2 py-1"
                  >
                    <span className="text-muted-foreground">
                      {translate(b.label)}
                    </span>
                    <span
                      className={cn("font-mono", b.value < 0 && "text-red-400")}
                    >
                      {b.value > 0 ? "+" : ""}
                      {b.value}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="grid gap-3 sm:grid-cols-2">
                {report.results.map((r) => {
                  const car = race.carByDriver(r.driverId)!;
                  const moved = r.gridPosition - r.position;
                  return (
                    <div
                      key={r.driverId}
                      className="flex items-center gap-3 rounded-xl bg-muted/60 p-3"
                    >
                      <DriverPortrait
                        driver={race.driver(car)}
                        team={race.team(car)}
                        className="size-12"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">
                          {race.driver(car).lastName}
                        </p>
                        <p className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                          P{r.gridPosition} →{" "}
                          {r.status === "dnf"
                            ? t("dnf")
                            : r.status === "dsq"
                              ? t("dsq")
                              : `P${r.position}`}
                          {r.status !== "dnf" &&
                            r.status !== "dsq" &&
                            moved !== 0 && (
                              <span
                                className={
                                  moved > 0
                                    ? "text-emerald-400"
                                    : "text-red-400"
                                }
                              >
                                ({moved > 0 ? "+" : ""}
                                {moved})
                              </span>
                            )}
                        </p>
                        <span className="mt-1 flex gap-0.5">
                          {car.stints.map((s, i) => (
                            <TyreBadge
                              key={i}
                              compound={s.compound}
                              className="size-4 text-[8px]"
                            />
                          ))}
                        </span>
                      </div>
                      <span className="font-mono text-xl font-black">
                        {r.points > 0 ? `+${r.points}` : "0"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          {teamId && (
            <Button size="lg" onClick={again} className="font-bold">
              <RotateCcw /> {t("again")}
            </Button>
          )}
          <Link
            href="/play"
            className={buttonVariants({ size: "lg", variant: "secondary" })}
          >
            <Settings2 /> {t("newSetup")}
          </Link>
          <Link
            href="/"
            className={buttonVariants({ size: "lg", variant: "ghost" })}
          >
            {t("home")}
          </Link>
        </div>

        <section
          className="overflow-x-auto rounded-xl border bg-card"
          aria-label={t("classification")}
        >
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b text-left text-[11px] text-muted-foreground uppercase">
              <tr>
                <th className="w-10 px-3 py-2 text-right">{t("pos")}</th>
                <th className="px-2 py-2">{t("driver")}</th>
                <th className="px-2 py-2 text-right">{t("grid")}</th>
                <th className="px-2 py-2 text-right">{t("time")}</th>
                <th className="px-2 py-2">{t("tyres")}</th>
                <th className="px-2 py-2 text-right">{t("bestLap")}</th>
                <th className="px-3 py-2 text-right">{t("pts")}</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {results.map((r) => {
                const car = race.carByDriver(r.driverId)!;
                const team = race.team(car);
                const isFastest = fastest?.car === car.index;
                return (
                  <tr
                    key={r.driverId}
                    className={cn(
                      "border-b border-border/50 last:border-0",
                      r.teamId === teamId && "bg-primary/10",
                    )}
                  >
                    <td className="px-3 py-1.5 text-right font-bold">
                      {r.status === "dnf"
                        ? "-"
                        : r.status === "dsq"
                          ? t("dsq")
                          : r.position}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="flex items-center gap-2 font-sans">
                        <span
                          className="h-4 w-1 rounded-full"
                          style={{ background: team.color }}
                        />
                        <b className="font-mono">{r.code}</b>
                        <span className="hidden text-muted-foreground sm:inline">
                          {team.shortName}
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right text-muted-foreground">
                      {r.gridPosition}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {r.position === 1 && r.totalTime
                        ? formatRaceTime(r.totalTime)
                        : r.status === "finished" && r.gap !== null
                          ? formatGap(r.gap)
                          : r.status === "lapped"
                            ? t("lapped", { laps: winner.laps - r.laps })
                            : r.status === "dnf"
                              ? t("dnfAt", { lap: r.laps })
                              : t("dsq")}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="flex gap-0.5">
                        {car.stints.map((s, i) => (
                          <TyreBadge
                            key={i}
                            compound={s.compound}
                            className="size-4 text-[8px]"
                          />
                        ))}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-2 py-1.5 text-right",
                        isFastest ? "text-[#C77DFF]" : "text-muted-foreground",
                      )}
                    >
                      {formatLapTime(r.bestLap)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-bold">
                      {r.points || ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
