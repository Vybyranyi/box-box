"use client";

import { TyreBadge } from "@/components/race/tyre-badge";
import { teams } from "@/data";
import type { QualiCar, QualiSession } from "@/engine";
import { formatLapTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

/** Live timing for the current part: best laps, gaps, who is out on track, the drop zone. */
export function QualiTiming({
  session,
  playerTeamId,
}: {
  session: QualiSession;
  playerTeamId: string;
}) {
  const t = useTranslations("quali");
  const standings = session.standings();
  const leader = standings[0]?.best[session.phase] ?? null;
  const knockout = session.phase < 2;

  const status = (car: QualiCar) => {
    if (car.eliminatedIn !== null && car.eliminatedIn < session.phase)
      return t("status.out");
    if (car.stage === "garage") return t("status.garage");
    if (car.stage === "out") return t("status.outLap");
    if (car.stage === "push") return t("status.flying");
    return t("status.inLap");
  };

  return (
    <section
      className="overflow-hidden rounded-xl border bg-card"
      aria-label={t("timing")}
    >
      <ol className="flex flex-col font-mono text-xs">
        {standings.map((car, i) => {
          const team = teams.find((x) => x.id === car.teamId)!;
          const best = car.best[session.phase];
          const danger = knockout && i >= session.keep;
          const onTrack = car.stage === "out" || car.stage === "push";
          return (
            <li
              key={car.driverId}
              className={cn(
                "grid h-7 grid-cols-[1.5rem_3px_3rem_1fr_auto_5.5rem_1.25rem] items-center gap-2 px-3",
                car.teamId === playerTeamId && "bg-primary/10",
                danger && "bg-red-500/10",
                knockout &&
                  i === session.keep &&
                  "border-t-2 border-t-red-500/60",
              )}
            >
              <span className="text-right font-bold">{i + 1}</span>
              <span
                className="h-4 rounded-full"
                style={{ background: team.color }}
              />
              <span className="font-bold">{car.code}</span>
              <span className="text-right tabular-nums">
                {best === null ? "-" : formatLapTime(best)}
              </span>
              <span className="w-16 text-right text-muted-foreground tabular-nums">
                {best !== null && leader !== null && i > 0
                  ? `+${(best - leader).toFixed(3)}`
                  : ""}
              </span>
              <span
                className={cn(
                  "truncate text-[10px] uppercase",
                  car.stage === "push"
                    ? "text-[#C77DFF]"
                    : onTrack
                      ? "text-emerald-400"
                      : "text-muted-foreground",
                )}
              >
                {status(car)}
              </span>
              <TyreBadge
                compound={car.compound}
                className="size-4 text-[8px]"
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
