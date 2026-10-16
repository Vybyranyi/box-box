"use client";

import { Button } from "@/components/ui/button";
import type { TrackStatus } from "@/engine";
import { SPEEDS, type Speed } from "@/game/race-runner";
import { Link } from "@/i18n/navigation";
import { formatRaceTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CircleHelp, CloudRain, Pause, Play, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

const STATUS_STYLE: Record<TrackStatus | "finished", string> = {
  green: "bg-emerald-500/15 text-emerald-400",
  sc: "bg-amber-400/20 text-amber-300",
  vsc: "bg-amber-400/20 text-amber-300",
  finished: "bg-foreground/10 text-foreground",
};

export function RaceHeader({
  trackName,
  circuitName,
  raceTime,
  status,
  wetness,
  raining,
  paused,
  speed,
  onTogglePause,
  onSpeed,
  autoPause,
}: {
  trackName: string;
  circuitName: string;
  raceTime: number;
  status: TrackStatus | "finished";
  wetness: number;
  raining: boolean;
  paused: boolean;
  speed: Speed;
  onTogglePause: () => void;
  onSpeed: (speed: Speed) => void;
  /** Only shown when the player runs a team. */
  autoPause?: { enabled: boolean; onToggle: () => void };
}) {
  const t = useTranslations("race");
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card px-4 py-2.5">
      <Link
        href="/"
        className="text-sm font-black text-muted-foreground uppercase italic hover:text-foreground"
        title={t("homeTitle")}
      >
        Box <span className="text-primary">Box</span>
      </Link>
      <div className="min-w-0">
        <h1 className="truncate text-lg leading-tight font-black uppercase italic">
          {trackName}
        </h1>
        <p className="truncate text-xs text-muted-foreground">{circuitName}</p>
      </div>

      <span
        className={cn(
          "rounded-md px-2 py-1 text-xs font-bold uppercase",
          STATUS_STYLE[status],
        )}
      >
        {t(`status.${status}`)}
      </span>

      <span
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
        title={t("wetnessTitle")}
      >
        {raining || wetness > 0.15 ? (
          <CloudRain className="size-4 text-sky-400" />
        ) : (
          <Sun className="size-4 text-amber-300" />
        )}
        <span className="font-mono">
          {wetness > 0.02
            ? t("wet", { percent: Math.round(wetness * 100) })
            : t("dry")}
        </span>
      </span>

      <span className="font-mono text-sm tabular-nums">
        {formatRaceTime(raceTime)}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/how-to-play"
          target="_blank"
          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          title={t("howTo")}
          aria-label={t("howTo")}
        >
          <CircleHelp className="size-5" />
        </Link>
        {autoPause && (
          <button
            type="button"
            onClick={autoPause.onToggle}
            aria-pressed={autoPause.enabled}
            title={t("autoPauseHint")}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
              autoPause.enabled
                ? "bg-amber-400/20 text-amber-300"
                : "bg-muted text-muted-foreground",
            )}
          >
            {t("autoPause", { enabled: String(autoPause.enabled) })}
          </button>
        )}
        <Button
          variant="secondary"
          size="icon"
          onClick={onTogglePause}
          disabled={status === "finished"}
          aria-label={paused ? t("resume") : t("pause")}
        >
          {paused ? <Play /> : <Pause />}
        </Button>
        <div
          className="flex rounded-lg bg-muted p-0.5"
          role="group"
          aria-label={t("speed")}
        >
          {SPEEDS.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => onSpeed(x)}
              className={cn(
                "rounded-md px-2 py-1 font-mono text-xs font-bold transition-colors",
                speed === x
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {x}×
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
