"use client";

import { Button } from "@/components/ui/button";
import type { Compound, Race, RaceCommand } from "@/engine";
import type { RaceAlert } from "@/game/alerts";
import { recommendedCompound } from "@/game/pit-wall";
import { CloudRain, Siren, TriangleAlert } from "lucide-react";
import { TyreBadge } from "./tyre-badge";

/** Decision prompt shown over the map when auto-pause stops the race. */
export function RaceAlertBanner({
  race,
  alert,
  onCommand,
  onDismiss,
}: {
  race: Race;
  alert: RaceAlert;
  onCommand: (command: RaceCommand) => void;
  /** Close the prompt and resume the race. */
  onDismiss: () => void;
}) {
  const cars = alert.cars
    .map((i) => race.cars[i])
    .filter((c) => c.status === "racing");
  const choices = cars.map((car) => ({
    car,
    compound: recommendedCompound(race, car) as Compound,
  }));
  const Icon =
    alert.kind === "sc" || alert.kind === "vsc"
      ? Siren
      : alert.kind === "rain" || alert.kind === "crossover"
        ? CloudRain
        : TriangleAlert;

  const box = (list: typeof choices) => {
    for (const { car, compound } of list)
      onCommand({ type: "pit", driverId: car.driverId, compound });
    onDismiss();
  };

  return (
    <div
      className="absolute inset-x-3 top-3 z-10 mx-auto max-w-lg rounded-xl border border-amber-400/40 bg-background/95 p-4 shadow-2xl backdrop-blur"
      role="alertdialog"
      aria-label={alert.title}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-amber-300" />
        <div className="flex-1">
          <h2 className="font-bold uppercase">{alert.title}</h2>
          <p className="text-sm text-muted-foreground">{alert.body}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {alert.kind !== "puncture" &&
          choices.map((choice) => (
            <Button
              key={choice.car.driverId}
              variant="secondary"
              onClick={() => box([choice])}
              disabled={choice.car.pitRequest !== null}
            >
              Box {choice.car.code} <TyreBadge compound={choice.compound} />
            </Button>
          ))}
        {alert.kind !== "puncture" && choices.length > 1 && (
          <Button variant="secondary" onClick={() => box(choices)}>
            Box both
          </Button>
        )}
        {alert.kind === "puncture" &&
          choices.map((choice) => (
            <Button
              key={choice.car.driverId}
              variant="secondary"
              onClick={() => box([choice])}
            >
              Fit <TyreBadge compound={choice.compound} />
            </Button>
          ))}
        <Button className="ml-auto" onClick={onDismiss}>
          {alert.kind === "puncture" ? "OK" : "Stay out"}{" "}
          <kbd className="ml-1 font-mono text-[10px] opacity-70">Esc</kbd>
        </Button>
      </div>
    </div>
  );
}
