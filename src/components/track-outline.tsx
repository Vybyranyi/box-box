import type { Track } from "@/data/types";
import { cn } from "@/lib/utils";

/** Static SVG outline of a track with the start/finish line and race direction. */
export function TrackOutline({
  track,
  className,
}: {
  track: Track;
  className?: string;
}) {
  // Data has y pointing north; SVG has y pointing down.
  const points = track.path.map(([x, y]) => [x, -y] as const);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const size = Math.max(maxX - minX, maxY - minY);
  const pad = size * 0.08;
  const stroke = size * 0.018;

  const d = `M${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`;
  const [sx, sy] = points[0];
  const [ax, ay] = points[Math.round(points.length * 0.04)];

  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
      className={cn("text-foreground", className)}
      role="img"
      aria-label={`${track.name} circuit outline`}
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinejoin="round"
      />
      <circle cx={sx} cy={sy} r={stroke * 1.6} className="fill-primary" />
      <circle cx={ax} cy={ay} r={stroke * 1.1} className="fill-chart-2" />
    </svg>
  );
}
