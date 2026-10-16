"use client";

import type { TowerGap, TowerRow } from "@/game/tower";
import { formatGap } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { TyreBadge } from "./tyre-badge";

export function TimingTower({
  rows,
  lap,
  totalLaps,
  selectedDriverId,
  onSelect,
}: {
  rows: TowerRow[];
  lap: number;
  totalLaps: number;
  selectedDriverId: string | null;
  onSelect: (driverId: string) => void;
}) {
  const t = useTranslations("tower");
  const [mode, setMode] = useState<"interval" | "leader">("interval");
  const gapText = (gap: TowerGap) => {
    if (gap.type === "time") return formatGap(gap.seconds);
    if (gap.type === "laps") return t("gapLaps", { laps: gap.laps });
    const labels = {
      leader: "gapLeader",
      winner: "gapWinner",
      pit: "gapPit",
      dnf: "gapDnf",
    } as const;
    return gap.label === "none" ? "-" : t(labels[gap.label]);
  };

  return (
    <section
      className="flex flex-col overflow-hidden rounded-xl border bg-card"
      aria-label={t("label")}
    >
      <header className="flex items-center justify-between border-b px-3 py-2">
        <p className="font-mono text-sm font-bold">
          {t("lap")}{" "}
          <span className="text-primary">{Math.min(lap + 1, totalLaps)}</span>
          <span className="text-muted-foreground">/{totalLaps}</span>
        </p>
        <div className="flex rounded-md bg-muted p-0.5 text-[11px] font-semibold uppercase">
          {(["interval", "leader"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded px-2 py-0.5 transition-colors",
                mode === m
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(m)}
            </button>
          ))}
        </div>
      </header>

      <ol className="flex flex-col">
        {rows.map((row) => (
          <li key={row.driverId}>
            <button
              type="button"
              onClick={() => onSelect(row.driverId)}
              className={cn(
                "grid h-7 w-full grid-cols-[1.5rem_3px_3rem_1fr_auto_2rem] items-center gap-2 px-3 text-left font-mono text-xs transition-colors hover:bg-accent",
                row.isPlayer && "bg-primary/10",
                row.driverId === selectedDriverId && "bg-accent",
                row.state === "retired" && "text-muted-foreground",
              )}
            >
              <span className="text-right font-bold tabular-nums">
                {row.state === "retired" ? "-" : row.position}
              </span>
              <span
                className="h-4 rounded-full"
                style={{ background: row.teamColor }}
              />
              <span className="flex items-center gap-1 font-bold">
                {row.code}
                {row.fastestLap && (
                  <span
                    className="size-1.5 rounded-full bg-[#B138DD]"
                    title={t("fastestLap")}
                  />
                )}
              </span>
              <span
                className={cn(
                  "text-right tabular-nums",
                  (row.state === "pit" || row.state === "retired") &&
                    "font-bold",
                  row.state === "pit" && "text-chart-2",
                )}
              >
                {gapText(mode === "interval" ? row.interval : row.gap)}
              </span>
              <span className="flex items-center gap-1">
                <TyreBadge
                  compound={row.compound}
                  className={cn(row.state === "retired" && "opacity-40")}
                />
                <span className="w-4 text-[10px] text-muted-foreground tabular-nums">
                  {row.tyreAge}
                </span>
              </span>
              <Gained value={row.gained} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Gained({ value }: { value: number }) {
  if (value === 0)
    return (
      <span className="text-center text-[10px] text-muted-foreground">-</span>
    );
  return (
    <span
      className={cn(
        "text-right text-[10px] font-bold",
        value > 0 ? "text-emerald-400" : "text-red-400",
      )}
    >
      {value > 0 ? "▲" : "▼"}
      {Math.abs(value)}
    </span>
  );
}
