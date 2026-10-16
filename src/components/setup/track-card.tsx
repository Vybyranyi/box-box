import { TrackOutline } from "@/components/track-outline";
import type { CalendarRound, Track } from "@/data/types";
import { cn } from "@/lib/utils";

export function TrackCard({
  track,
  round,
  status,
  selected,
  onSelect,
}: {
  track: Track;
  round: CalendarRound;
  status: "raced" | "next" | "upcoming";
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border bg-card p-3 text-left transition-all hover:border-foreground/30",
        selected && "border-primary ring-2 ring-primary",
      )}
    >
      <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground uppercase">
        <span>R{round.round}</span>
        {status === "next" && (
          <span className="rounded bg-primary/20 px-1 text-primary">
            Next GP
          </span>
        )}
        {status === "raced" && <span>Raced</span>}
      </div>
      <h3 className="truncate text-sm font-bold uppercase">{track.name}</h3>
      <TrackOutline
        track={track}
        className={cn(
          "aspect-[4/3] w-full",
          selected ? "text-primary" : "text-foreground/80",
        )}
      />
      <div className="flex flex-wrap gap-1 font-mono text-[10px] text-muted-foreground">
        <span>{track.laps} laps</span>·
        <span>Deg {track.tyreDegradation}/5</span>·
        <span>Ovt {track.overtakingDifficulty}/5</span>
      </div>
    </button>
  );
}
