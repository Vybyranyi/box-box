"use client";

import { DriverPortrait } from "@/components/driver-portrait";
import { TyreBadge } from "@/components/race/tyre-badge";
import { Button } from "@/components/ui/button";
import { drivers, teams } from "@/data";
import type {
  Compound,
  QualiCar,
  QualiCommand,
  QualiSession,
  QualiTyre,
} from "@/engine";
import { formatLapTime, formatRaceTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useState } from "react";

const TYRE_COMPOUND: Record<QualiTyre, Compound> = {
  "soft-new": "soft",
  "soft-used": "soft",
  medium: "medium",
  intermediate: "intermediate",
  wet: "wet",
};

/** One of the player's cars in qualifying: send it out, on which tyres, and what to watch. */
export function QualiCarCard({
  session,
  car,
  onCommand,
}: {
  session: QualiSession;
  car: QualiCar;
  onCommand: (command: QualiCommand) => void;
}) {
  const t = useTranslations("quali");
  const driver = drivers.find((d) => d.id === car.driverId)!;
  const team = teams.find((x) => x.id === car.teamId)!;
  const options = session.tyreOptions(car);
  const [picked, setPicked] = useState<QualiTyre | null>(null);
  const [pushLaps, setPushLaps] = useState<1 | 2>(1);
  const tyre = picked && options.includes(picked) ? picked : options[0];

  const out = car.eliminatedIn !== null;
  const phase = session.phase;
  const standings = session.standings();
  const position = standings.indexOf(car) + 1;
  const best = car.best[phase];
  const cutoff = session.cutoff();
  const left = session.duration - session.clock;
  const lastChance = session.latestStart(car) - session.clock;
  const readyIn = Math.max(0, car.readyAt - session.clock);
  const onTrack = car.stage !== "garage";
  const progress = onTrack
    ? (session.clock - car.stageStartedAt) /
      Math.max(1, car.stageEndsAt - car.stageStartedAt)
    : 0;
  const lastLap = car.laps.at(-1);

  // Where the car stands against the drop zone.
  let zone: { text: string; tone: string } | null = null;
  if (!out && phase < 2) {
    const safe = best !== null && position <= session.keep;
    if (best === null) zone = { text: t("noTime"), tone: "text-amber-300" };
    else if (cutoff !== null && !safe)
      zone = {
        text: t("needs", { gap: (best - cutoff).toFixed(3) }),
        tone: "text-red-400",
      };
    else {
      const first = standings[session.keep];
      const margin = first?.best[phase] ?? null;
      zone = {
        text:
          margin !== null
            ? t("margin", { gap: (margin - best).toFixed(3) })
            : t("through"),
        tone: "text-emerald-400",
      };
    }
  }

  return (
    <section
      className="flex flex-col gap-2.5 rounded-xl border bg-card p-3"
      style={{ borderTopColor: team.color, borderTopWidth: 3 }}
    >
      <div className="flex items-center gap-3">
        <DriverPortrait driver={driver} team={team} className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {driver.firstName[0]}.{" "}
            <span className="uppercase">{driver.lastName}</span>
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {best === null ? "-" : formatLapTime(best)}
            {zone && <span className={cn("ml-2", zone.tone)}>{zone.text}</span>}
          </p>
        </div>
        <span className="font-mono text-2xl font-black">
          {out ? t("outShort") : best === null ? "-" : `P${position}`}
        </span>
      </div>

      {out ? (
        <p className="text-xs text-muted-foreground">
          {t("knockedOut", { phase: car.eliminatedIn! + 1 })}
        </p>
      ) : (
        <>
          {lastLap && lastLap.phase === phase && (
            <p className="font-mono text-[11px] text-muted-foreground">
              {t("lastLap")}{" "}
              <span className="text-foreground">
                {lastLap.deleted ? t("deleted") : formatLapTime(lastLap.time)}
              </span>
              {lastLap.mistake && (
                <span className="ml-1.5 text-amber-300">{t("mistake")}</span>
              )}
              {lastLap.traffic && (
                <span className="ml-1.5 text-amber-300">{t("traffic")}</span>
              )}
            </p>
          )}

          {onTrack ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <TyreBadge compound={car.compound} />
                <span
                  className={cn(
                    "uppercase",
                    car.stage === "push"
                      ? "text-[#C77DFF]"
                      : "text-emerald-400",
                  )}
                >
                  {car.stage === "out"
                    ? t("status.outLap")
                    : car.stage === "push"
                      ? t("status.flying")
                      : t("status.inLap")}
                </span>
                {car.stage !== "in" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="ml-auto"
                    onClick={() =>
                      onCommand({ type: "abort", driverId: car.driverId })
                    }
                  >
                    {t("abort")}
                  </Button>
                )}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    car.stage === "push" ? "bg-[#C77DFF]" : "bg-emerald-500",
                  )}
                  style={{ width: `${Math.min(100, progress * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={tyre === option}
                    onClick={() => setPicked(option)}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors",
                      tyre === option
                        ? "border-foreground bg-muted"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <TyreBadge
                      compound={TYRE_COMPOUND[option]}
                      className="size-4 text-[8px]"
                    />
                    {t(`tyres.${option}`)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="flex rounded-lg bg-muted p-0.5"
                  role="group"
                  aria-label={t("pushLaps")}
                >
                  {([1, 2] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      title={t(`pushHint.${n}`)}
                      onClick={() => setPushLaps(n)}
                      className={cn(
                        "rounded-md px-2 py-1 text-[11px] font-semibold",
                        pushLaps === n
                          ? "bg-background text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {t("laps", { laps: n })}
                    </button>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="ml-auto font-bold"
                  disabled={!session.canGo(car)}
                  onClick={() =>
                    onCommand({
                      type: "run",
                      driverId: car.driverId,
                      tyre,
                      pushLaps,
                    })
                  }
                >
                  {t("go")}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {readyIn > 0
                  ? t("readyIn", { time: formatRaceTime(readyIn) })
                  : left <= 0
                    ? t("sessionOver")
                    : lastChance > 0
                      ? t("lastChance", { time: formatRaceTime(lastChance) })
                      : t("tooLate")}
                {" · "}
                {t("sets", { sets: car.softSets })}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
