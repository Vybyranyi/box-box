"use client";

import { DriverPortrait } from "@/components/driver-portrait";
import type { CarState, Race } from "@/engine";
import { formatLapTime } from "@/lib/format";
import { TYRE_COLORS, TyreBadge } from "./tyre-badge";

/** Spectator panel: the selected car and the fastest lap. */
export function RaceInfo({ race, car }: { race: Race; car: CarState | null }) {
  return (
    <div className="flex flex-col gap-3">
      {car && <CarCard race={race} car={car} />}
      <FastestLap race={race} />
    </div>
  );
}

export function FastestLap({ race }: { race: Race }) {
  const fastest = race.fastestLap;
  if (!fastest) return null;
  return (
    <section className="flex items-center justify-between rounded-xl border bg-card px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
        <span className="size-2 rounded-full bg-[#B138DD]" />
        Fastest lap
      </span>
      <span className="font-mono">
        <b>{race.cars[fastest.car].code}</b> {formatLapTime(fastest.time)}{" "}
        <span className="text-muted-foreground">L{fastest.lap}</span>
      </span>
    </section>
  );
}

function CarCard({ race, car }: { race: Race; car: CarState }) {
  const driver = race.driver(car);
  const team = race.team(car);
  const wear = Math.min(100, car.tyre.wear);
  const status =
    car.status === "retired"
      ? "Retired"
      : car.status === "pit"
        ? "In the pits"
        : car.status === "finished"
          ? "Finished"
          : null;

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border bg-card p-3"
      style={{ borderTopColor: team.color, borderTopWidth: 3 }}
    >
      <div className="flex items-center gap-3">
        <DriverPortrait driver={driver} team={team} className="size-14" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {driver.firstName}{" "}
            <span className="uppercase">{driver.lastName}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {team.shortName}
          </p>
        </div>
        <span className="font-mono text-2xl font-black">P{car.position}</span>
      </div>

      {status && (
        <p className="text-xs font-bold text-amber-300 uppercase">{status}</p>
      )}

      <div className="flex items-center gap-2">
        <TyreBadge compound={car.tyre.compound} />
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
          title={`Tyre wear ${Math.round(wear)}%`}
        >
          <div
            className="h-full rounded-full transition-[width]"
            style={{
              width: `${100 - wear}%`,
              background:
                wear > 70 ? "#ef4444" : TYRE_COLORS[car.tyre.compound],
            }}
          />
        </div>
        <span className="w-16 text-right font-mono text-xs text-muted-foreground">
          {Math.round(100 - wear)}% · {car.tyre.age}L
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-2 font-mono text-xs">
        <Stat label="Last" value={formatLapTime(car.lastLapTime)} />
        <Stat label="Best" value={formatLapTime(car.bestLapTime)} />
        <Stat label="Stops" value={String(car.pitStops.length)} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-muted px-2 py-1">
      <dt className="text-[10px] text-muted-foreground uppercase">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
