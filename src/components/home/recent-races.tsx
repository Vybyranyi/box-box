"use client";

import { teams } from "@/data";
import { EMPTY_HISTORY, HISTORY_KEY, type HistoryEntry } from "@/game/history";
import { Link } from "@/i18n/navigation";
import { useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const GRADE_STYLE = {
  S: "text-amber-300",
  A: "text-emerald-400",
  B: "text-sky-400",
  C: "text-orange-400",
  D: "text-red-400",
} as const;

/** The player's last races, stored in this browser. */
export function RecentRaces() {
  const t = useTranslations("home.recent");
  const tTracks = useTranslations("tracks");
  const [history] = useStored<HistoryEntry[]>(HISTORY_KEY, EMPTY_HISTORY);
  if (history.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-label={t("title")}>
      <h2 className="text-xl font-black uppercase italic">{t("title")}</h2>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {history.slice(0, 6).map((entry) => {
          const team = teams.find((x) => x.id === entry.teamId);
          const query = new URLSearchParams({
            track: entry.trackId,
            team: entry.teamId,
            laps: String(entry.laps),
            weather: entry.weather,
            difficulty: entry.difficulty ?? "normal",
            quali: entry.qualifying ?? "auto",
            seed: String(entry.seed),
          });
          return (
            <li key={entry.id}>
              <Link
                href={`/qualifying?${query}`}
                title={t("replay")}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-foreground/30"
                style={{ borderLeftColor: team?.color, borderLeftWidth: 4 }}
              >
                <span
                  className={cn(
                    "w-8 text-center text-3xl font-black italic",
                    GRADE_STYLE[entry.grade],
                  )}
                >
                  {entry.grade}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {tTracks(entry.trackId as never)} · {team?.shortName}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    {entry.finishes
                      .map((f) => `${f.code} ${f.result}`)
                      .join(" · ")}{" "}
                    · {t("laps", { laps: entry.laps })}
                  </span>
                </span>
                <span className="font-mono text-sm font-bold">
                  {t("points", { points: entry.points })}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
