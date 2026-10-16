"use client";

import { Button } from "@/components/ui/button";
import type { TrackStatus } from "@/engine";
import { SPEEDS, type Speed } from "@/game/race-runner";
import { formatRaceTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CloudRain, Pause, Play, Sun } from "lucide-react";
import Link from "next/link";

const STATUS: Record<
  TrackStatus | "finished",
  { label: string; className: string }
> = {
  green: {
    label: "Green flag",
    className: "bg-emerald-500/15 text-emerald-400",
  },
  sc: { label: "Safety Car", className: "bg-amber-400/20 text-amber-300" },
  vsc: { label: "Virtual SC", className: "bg-amber-400/20 text-amber-300" },
  finished: {
    label: "Chequered flag",
    className: "bg-foreground/10 text-foreground",
  },
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
  const s = STATUS[status];
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card px-4 py-2.5">
      <Link
        href="/"
        className="text-sm font-black text-muted-foreground uppercase italic hover:text-foreground"
        title="Back to the home page"
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
          s.className,
        )}
      >
        {s.label}
      </span>

      <span
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
        title="Track wetness"
      >
        {raining || wetness > 0.15 ? (
          <CloudRain className="size-4 text-sky-400" />
        ) : (
          <Sun className="size-4 text-amber-300" />
        )}
        <span className="font-mono">
          {wetness > 0.02 ? `${Math.round(wetness * 100)}% wet` : "Dry"}
        </span>
      </span>

      <span className="font-mono text-sm tabular-nums">
        {formatRaceTime(raceTime)}
      </span>

      <div className="ml-auto flex items-center gap-2">
        {autoPause && (
          <button
            type="button"
            onClick={autoPause.onToggle}
            aria-pressed={autoPause.enabled}
            title="Pause automatically on Safety Cars, rain and tyre warnings"
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
              autoPause.enabled
                ? "bg-amber-400/20 text-amber-300"
                : "bg-muted text-muted-foreground",
            )}
          >
            Auto-pause {autoPause.enabled ? "on" : "off"}
          </button>
        )}
        <Button
          variant="secondary"
          size="icon"
          onClick={onTogglePause}
          disabled={status === "finished"}
          aria-label={paused ? "Resume" : "Pause"}
        >
          {paused ? <Play /> : <Pause />}
        </Button>
        <div
          className="flex rounded-lg bg-muted p-0.5"
          role="group"
          aria-label="Simulation speed"
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
