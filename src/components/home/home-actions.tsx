"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { calendar, getTrack, meta, teams } from "@/data";
import {
  DEFAULT_SETTINGS,
  lapsFor,
  newSeed,
  raceQuery,
  type Settings,
} from "@/game/race-options";
import { Link, useRouter } from "@/i18n/navigation";
import { useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { BookOpen, Flag, Shuffle } from "lucide-react";
import { useTranslations } from "next-intl";

export function HomeActions() {
  const t = useTranslations("home");
  const router = useRouter();
  const [settings] = useStored<Settings>("settings", DEFAULT_SETTINGS);

  const quickRace = () => {
    const values = crypto.getRandomValues(new Uint32Array(2));
    const team = teams[values[0] % teams.length];
    const upcoming = calendar.filter((r) => r.round > meta.lastCompletedRound);
    const pool = upcoming.length ? upcoming : calendar;
    const track = getTrack(pool[values[1] % pool.length].trackId);
    router.push(
      `/qualifying?${raceQuery({ trackId: track.id, teamId: team.id, laps: lapsFor(track, "sprint"), weather: "auto", difficulty: settings.difficulty ?? "normal", qualifying: "auto", seed: newSeed() })}`,
    );
  };

  return (
    <div className="flex flex-wrap gap-3">
      <Link
        href="/play"
        className={cn(
          buttonVariants({ size: "lg" }),
          "h-11 px-5 text-base font-bold",
        )}
      >
        <Flag /> {t("start")}
      </Link>
      <Button
        size="lg"
        variant="secondary"
        className="h-11 px-5 text-base"
        onClick={quickRace}
      >
        <Shuffle /> {t("quick")}
      </Button>
      <Link
        href="/how-to-play"
        className={cn(
          buttonVariants({ size: "lg", variant: "ghost" }),
          "h-11 px-5 text-base",
        )}
      >
        <BookOpen /> {t("howTo")}
      </Link>
    </div>
  );
}
