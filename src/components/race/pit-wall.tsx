"use client";

import { RemoteImage } from "@/components/remote-image";
import { getTeamImage } from "@/data/images";
import type { Race, RaceCommand, TeamOrder } from "@/engine";
import { cn } from "@/lib/utils";
import { PlayerCarCard } from "./player-car-card";

const ORDERS: { order: TeamOrder; label: string; hint: string }[] = [
  {
    order: "free",
    label: "Free to race",
    hint: "Drivers may fight each other",
  },
  { order: "hold", label: "Hold", hint: "No overtaking between teammates" },
  {
    order: "swap",
    label: "Swap",
    hint: "The car ahead lets its teammate through when they're close",
  },
];

/** The player's team: both cars and team orders. */
export function PitWall({
  race,
  teamId,
  selectedDriverId,
  onSelect,
  onCommand,
}: {
  race: Race;
  teamId: string;
  selectedDriverId: string | null;
  onSelect: (driverId: string) => void;
  onCommand: (command: RaceCommand) => void;
}) {
  const team = race.config.teams.find((t) => t.id === teamId)!;
  const cars = race.cars
    .filter((c) => c.teamId === teamId)
    .sort((a, b) => a.position - b.position);
  const current = race.teamOrders[teamId] ?? "free";
  const bothRunning = cars.every(
    (c) => c.status === "racing" || c.status === "pit",
  );

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center gap-2 px-1">
        <RemoteImage
          src={getTeamImage(team, "logo", 64)}
          alt=""
          className="size-5 object-contain"
          fallback={
            <span
              className="size-3 rounded-full"
              style={{ background: team.color }}
            />
          }
        />
        <h2 className="text-sm font-bold uppercase">
          Pit wall · {team.shortName}
        </h2>
      </header>

      {cars.map((car) => (
        <PlayerCarCard
          key={car.driverId}
          race={race}
          car={car}
          selected={car.driverId === selectedDriverId}
          onSelect={() => onSelect(car.driverId)}
          onCommand={onCommand}
        />
      ))}

      <section
        className="flex flex-col gap-1.5 rounded-xl border bg-card p-3"
        aria-label="Team orders"
      >
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase">
          Team orders
        </h3>
        <div className="flex rounded-lg bg-muted p-0.5" role="group">
          {ORDERS.map((o) => (
            <button
              key={o.order}
              type="button"
              title={o.hint}
              disabled={!bothRunning}
              onClick={() =>
                onCommand({ type: "team-order", teamId, order: o.order })
              }
              className={cn(
                "flex-1 rounded-md py-1 text-xs font-semibold transition-colors disabled:opacity-40",
                current === o.order
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        {current === "swap" && (
          <p className="text-[11px] text-amber-300">
            Waiting for the cars to be within 2.5 s…
          </p>
        )}
      </section>
    </div>
  );
}
