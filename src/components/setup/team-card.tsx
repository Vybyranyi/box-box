"use client";

import { DriverPortrait } from "@/components/driver-portrait";
import { RemoteImage } from "@/components/remote-image";
import { getTeamDrivers } from "@/data";
import { getTeamImage } from "@/data/images";
import type { Team } from "@/data/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

/** Message key under setup.tier for a team's overall car rank. */
export function tierFor(rank: number): "front" | "midfield" | "pack" | "back" {
  if (rank <= 3) return "front";
  if (rank <= 6) return "midfield";
  if (rank <= 9) return "pack";
  return "back";
}

export function TeamCard({
  team,
  rank,
  selected,
  onSelect,
}: {
  team: Team;
  rank: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("setup");
  const pace = Math.max(5, 100 - team.car.paceDeficitPct * 20);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/30",
        selected && "border-transparent ring-2",
      )}
      style={{
        borderTopColor: team.color,
        borderTopWidth: 4,
        ...(selected ? { ["--tw-ring-color" as string]: team.color } : {}),
      }}
    >
      {selected && (
        <span
          className="absolute top-3 right-3 grid size-6 place-items-center rounded-full text-white"
          style={{ background: team.color }}
        >
          <Check className="size-4" />
        </span>
      )}
      <div className="flex items-center gap-2.5">
        <RemoteImage
          src={getTeamImage(team, "logo", 80)}
          alt=""
          className="size-7 object-contain"
          fallback={
            <span
              className="size-5 rounded-full"
              style={{ background: team.color }}
            />
          }
        />
        <div>
          <h3 className="leading-tight font-bold uppercase">
            {team.shortName}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t(`tier.${tierFor(rank)}`)} ·{" "}
            {t("championship", { position: team.championship.position })}
          </p>
        </div>
      </div>

      <RemoteImage
        src={getTeamImage(team, "car", 640)}
        alt={`${team.shortName} car`}
        className="h-16 w-full object-contain transition-transform group-hover:scale-105"
        fallback={<div className="h-16" />}
      />

      <div className="flex gap-3">
        {getTeamDrivers(team.id).map((d) => (
          <div key={d.id} className="flex min-w-0 flex-1 items-center gap-2">
            <DriverPortrait
              driver={d}
              team={team}
              className="size-9 shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{d.lastName}</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                #{d.number}
              </p>
            </div>
          </div>
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground uppercase">{t("carPace")}</dt>
          <dd className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${pace}%`, background: team.color }}
            />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground uppercase">
            {t("reliability")}
          </dt>
          <dd className="font-mono">
            {Math.round(team.car.reliability * 100)}%
          </dd>
        </div>
      </dl>
    </button>
  );
}
