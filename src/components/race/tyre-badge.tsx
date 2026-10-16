import type { Compound } from "@/engine";
import { cn } from "@/lib/utils";

/** Pirelli sidewall colours. */
export const TYRE_COLORS: Record<Compound, string> = {
  soft: "#E8002D",
  medium: "#FFD12E",
  hard: "#F0F0EC",
  intermediate: "#43B02A",
  wet: "#0067AD",
};

const LETTER: Record<Compound, string> = {
  soft: "S",
  medium: "M",
  hard: "H",
  intermediate: "I",
  wet: "W",
};

export function TyreBadge({
  compound,
  className,
}: {
  compound: Compound;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-grid size-5 shrink-0 place-items-center rounded-full border-[2.5px] bg-background font-mono text-[10px] leading-none font-bold",
        className,
      )}
      style={{
        borderColor: TYRE_COLORS[compound],
        color: TYRE_COLORS[compound],
      }}
      title={compound}
    >
      {LETTER[compound]}
    </span>
  );
}
