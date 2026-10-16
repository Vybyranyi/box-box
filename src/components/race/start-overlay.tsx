"use client";

import { DriverPortrait } from "@/components/driver-portrait";
import { Button } from "@/components/ui/button";
import { idealCompoundFor, type Compound, type Race } from "@/engine";
import { suggestedStart } from "@/game/pit-wall";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { TyreBadge } from "./tyre-badge";

const DRY: Compound[] = ["soft", "medium", "hard"];
const ALL: Compound[] = ["soft", "medium", "hard", "intermediate", "wet"];

/** Before the lights go out: pick each car's starting tyre. */
export function StartOverlay({
  race,
  teamId,
  onStart,
}: {
  race: Race;
  teamId: string;
  onStart: (tyres: Record<string, Compound>) => void;
}) {
  const cars = race.cars
    .filter((c) => c.teamId === teamId)
    .sort((a, b) => a.gridPosition - b.gridPosition);
  const advice = Object.fromEntries(
    cars.map((c) => [c.driverId, suggestedStart(race, c)]),
  );
  const [tyres, setTyres] = useState<Record<string, Compound>>(() =>
    Object.fromEntries(
      cars.map((c) => [c.driverId, advice[c.driverId].compound]),
    ),
  );
  const wet = idealCompoundFor(race.weather.wetness) !== "dry";
  const options = wet ? ALL : DRY;

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border bg-card p-5 shadow-2xl">
        <div>
          <p className="font-mono text-xs text-muted-foreground uppercase">
            {race.track.name} · {race.laps} laps ·{" "}
            {wet ? "wet track" : "dry track"} · rain risk{" "}
            {Math.round(race.track.rainProbability * 100)}%
          </p>
          <h2 className="text-2xl font-black uppercase italic">
            Starting tyres
          </h2>
          {race.requireTwoCompounds && !wet && (
            <p className="text-xs text-muted-foreground">
              Dry race: each car must use two different compounds.
            </p>
          )}
        </div>

        {cars.map((car) => (
          <div key={car.driverId} className="flex items-center gap-3">
            <DriverPortrait
              driver={race.driver(car)}
              team={race.team(car)}
              className="size-12"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                <span className="font-mono">P{car.gridPosition}</span>{" "}
                {race.driver(car).lastName}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {advice[car.driverId].summary}
              </p>
            </div>
            <div
              className="flex gap-1"
              role="radiogroup"
              aria-label={`${car.code} starting tyre`}
            >
              {options.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={tyres[car.driverId] === c}
                  onClick={() => setTyres((t) => ({ ...t, [car.driverId]: c }))}
                  className={cn(
                    "rounded-full p-0.5",
                    tyres[car.driverId] === c
                      ? "ring-2 ring-foreground"
                      : "opacity-50 hover:opacity-100",
                  )}
                >
                  <TyreBadge compound={c} className="size-6 text-xs" />
                </button>
              ))}
            </div>
          </div>
        ))}

        <Button
          size="lg"
          className="font-bold uppercase"
          onClick={() => onStart(tyres)}
        >
          Lights out
        </Button>
      </div>
    </div>
  );
}
