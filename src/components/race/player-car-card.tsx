"use client";

import { DriverPortrait } from "@/components/driver-portrait";
import { Button } from "@/components/ui/button";
import type { CarState, Compound, PaceMode, Race, RaceCommand } from "@/engine";
import {
  estimatedWear,
  lapsLeftOnTyre,
  needsSecondCompound,
  planSummary,
  recommendedCompound,
} from "@/game/pit-wall";
import { formatGap, formatLapTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { TYRE_COLORS, TyreBadge } from "./tyre-badge";

const COMPOUNDS: Compound[] = ["soft", "medium", "hard", "intermediate", "wet"];
const PACE: { mode: PaceMode; label: string; hint: string }[] = [
  { mode: "push", label: "Push", hint: "Faster, but wears tyres ~35% quicker" },
  { mode: "balanced", label: "Balanced", hint: "Normal race pace" },
  {
    mode: "conserve",
    label: "Conserve",
    hint: "Slower, tyres last ~30% longer",
  },
];

export function PlayerCarCard({
  race,
  car,
  selected,
  onSelect,
  onCommand,
}: {
  race: Race;
  car: CarState;
  selected: boolean;
  onSelect: () => void;
  onCommand: (command: RaceCommand) => void;
}) {
  const driver = race.driver(car);
  const team = race.team(car);
  const [compound, setCompound] = useState<Compound | null>(null);
  const active = car.status === "racing" || car.status === "pit";
  const chosen = compound ?? recommendedCompound(race, car);

  const orderIndex = race.order.indexOf(car.index);
  const behind = race.cars[race.order[orderIndex + 1]];
  const wear = estimatedWear(race, car);
  const lapsLeft = lapsLeftOnTyre(race, car);
  const lastLaps = car.lapTimes.slice(-3).reverse();
  const mustSwitch = needsSecondCompound(race, car);

  return (
    <section
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border bg-card p-3 transition-colors",
        selected && "ring-2 ring-primary/60",
      )}
      style={{ borderTopColor: team.color, borderTopWidth: 3 }}
      aria-label={`${driver.lastName} controls`}
    >
      <div className="flex items-center gap-3">
        <DriverPortrait driver={driver} team={team} className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {driver.firstName[0]}.{" "}
            <span className="uppercase">{driver.lastName}</span>
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {car.position > 1 && car.interval !== null
              ? `▲ ${formatGap(car.interval)}`
              : car.position === 1
                ? "Leading"
                : "▲ -"}
            {"  "}
            {behind && behind.interval !== null && behind.status === "racing"
              ? `▼ ${formatGap(behind.interval)}`
              : ""}
          </p>
        </div>
        <span className="font-mono text-2xl font-black">
          {car.status === "retired" ? "DNF" : `P${car.position}`}
        </span>
      </div>

      {active && (
        <>
          <div className="flex items-center gap-2" title="Estimated tyre wear">
            <TyreBadge compound={car.tyre.compound} />
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: `${100 - wear}%`,
                  background:
                    wear > 70 ? "#ef4444" : TYRE_COLORS[car.tyre.compound],
                }}
              />
            </div>
            <span className="w-24 text-right font-mono text-[11px] text-muted-foreground">
              ~{Math.round(wear)}% · {lapsLeft ?? "-"}L left
            </span>
          </div>

          <div className="flex gap-1 font-mono text-[11px]">
            {lastLaps.length === 0 && (
              <span className="text-muted-foreground">No laps yet</span>
            )}
            {lastLaps.map((t, i) => (
              <span
                key={i}
                className={cn(
                  "rounded bg-muted px-1.5 py-0.5",
                  t === car.bestLapTime && "text-emerald-400",
                  race.fastestLap?.car === car.index &&
                    t === race.fastestLap.time &&
                    "text-[#C77DFF]",
                  i > 0 && "opacity-60",
                )}
              >
                {formatLapTime(t)}
              </span>
            ))}
          </div>

          <div
            className="flex rounded-lg bg-muted p-0.5"
            role="group"
            aria-label="Pace mode"
          >
            {PACE.map((p) => (
              <button
                key={p.mode}
                type="button"
                title={p.hint}
                onClick={(e) => {
                  e.stopPropagation();
                  onCommand({
                    type: "pace",
                    driverId: car.driverId,
                    mode: p.mode,
                  });
                }}
                className={cn(
                  "flex-1 rounded-md py-1 text-xs font-semibold transition-colors",
                  car.paceMode === p.mode
                    ? p.mode === "push"
                      ? "bg-red-500/80 text-white"
                      : p.mode === "conserve"
                        ? "bg-sky-600/80 text-white"
                        : "bg-background text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {car.status === "pit" ? (
            <p className="rounded-md bg-amber-400/15 py-1.5 text-center text-xs font-bold text-amber-300 uppercase">
              In the pit lane
            </p>
          ) : car.pitRequest ? (
            <div className="flex items-center gap-2">
              <p className="flex flex-1 items-center gap-2 rounded-md bg-primary/20 px-2 py-1.5 text-xs font-bold uppercase">
                Box this lap <TyreBadge compound={car.pitRequest} />
              </p>
              <Button
                size="sm"
                variant="secondary"
                disabled={car.punctured}
                onClick={(e) => {
                  e.stopPropagation();
                  onCommand({ type: "cancel-pit", driverId: car.driverId });
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div
                className="flex gap-1"
                role="radiogroup"
                aria-label="Tyre for the next stop"
              >
                {COMPOUNDS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={chosen === c}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCompound(c);
                    }}
                    className={cn(
                      "rounded-full p-0.5 transition-opacity",
                      chosen === c
                        ? "ring-2 ring-foreground"
                        : "opacity-50 hover:opacity-100",
                    )}
                  >
                    <TyreBadge compound={c} />
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                className="ml-auto font-bold"
                onClick={(e) => {
                  e.stopPropagation();
                  onCommand({
                    type: "pit",
                    driverId: car.driverId,
                    compound: chosen,
                  });
                }}
              >
                Box
              </Button>
            </div>
          )}
        </>
      )}

      <p
        className={cn(
          "text-[11px] text-muted-foreground",
          mustSwitch && race.laps - car.lap < 15 && "text-amber-300",
        )}
      >
        {planSummary(race, car)}
      </p>
    </section>
  );
}
