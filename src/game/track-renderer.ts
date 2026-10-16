import type { Team } from "@/data/types";
import type { Race } from "@/engine";
import type { RaceRunner } from "./race-runner";

const COLORS = {
  trackEdge: "#3a404c",
  track: "#22262e",
  centreLine: "rgba(255,255,255,0.07)",
  pitLane: "rgba(255,255,255,0.22)",
  label: "rgba(10,12,16,0.85)",
  labelText: "#f2f3f5",
  retired: "#6b7280",
  safetyCar: "#FFB800",
  vscTint: "rgba(255,184,0,0.35)",
};

const CAR_RADIUS = 6.5;
const PIT_LANE_OFFSET = 18;
/** Share of the lap the pit lane spans on either side of the line, for drawing. */
const PIT_LANE_SPAN = 0.035;

type Rect = { x: number; y: number; w: number; h: number };

export type RenderOptions = {
  selectedDriverId: string | null;
  playerTeamId: string | null;
};

/** Draws the track and the cars onto a canvas. Knows nothing about React. */
export class TrackRenderer {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private points = new Float32Array(0);
  private pitNormal: [number, number] = [0, 0];
  private trackPath: Path2D | null = null;
  private readonly mono: string;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly race: Race,
  ) {
    this.ctx = canvas.getContext("2d")!;
    // Canvas fonts can't use CSS variables: resolve next/font's generated family name.
    const family = getComputedStyle(canvas)
      .getPropertyValue("--font-jetbrains-mono")
      .trim();
    this.mono = family ? `${family}, monospace` : "monospace";
  }

  resize(width: number, height: number, dpr: number) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.layout();
  }

  /** Fit the track into the canvas (north up) and cache screen-space geometry. */
  private layout() {
    const path = this.race.track.path;
    const xs = path.map((p) => p[0]);
    const ys = path.map((p) => p[1]);
    const [minX, maxX, minY, maxY] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    ];
    const pad = 36;
    const scale = Math.min(
      (this.width - pad * 2) / (maxX - minX),
      (this.height - pad * 2) / (maxY - minY),
    );
    const offX = (this.width - (maxX - minX) * scale) / 2;
    const offY = (this.height - (maxY - minY) * scale) / 2;

    this.points = new Float32Array(path.length * 2);
    path.forEach(([x, y], i) => {
      this.points[i * 2] = offX + (x - minX) * scale;
      this.points[i * 2 + 1] = offY + (maxY - y) * scale;
    });

    const trackPath = new Path2D();
    for (let i = 0; i < path.length; i++) {
      const [x, y] = [this.points[i * 2], this.points[i * 2 + 1]];
      if (i === 0) trackPath.moveTo(x, y);
      else trackPath.lineTo(x, y);
    }
    trackPath.closePath();
    this.trackPath = trackPath;

    // Pit lane runs alongside the start/finish straight, on the infield side.
    const [x0, y0] = this.at(0);
    const [x1, y1] = this.at(this.race.lapLength * 0.01);
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    let normal: [number, number] = [-(y1 - y0) / len, (x1 - x0) / len];
    const towardsCentre =
      (this.width / 2 - x0) * normal[0] + (this.height / 2 - y0) * normal[1];
    if (towardsCentre < 0) normal = [-normal[0], -normal[1]];
    this.pitNormal = normal;
  }

  /** Screen position at a distance along the lap (wraps, handles negative distances). */
  private at(distance: number): [number, number] {
    const n = this.points.length / 2;
    const L = this.race.lapLength;
    const f = ((((distance % L) + L) % L) / L) * n;
    const i = Math.floor(f) % n;
    const j = (i + 1) % n;
    const t = f - Math.floor(f);
    return [
      this.points[i * 2] + (this.points[j * 2] - this.points[i * 2]) * t,
      this.points[i * 2 + 1] +
        (this.points[j * 2 + 1] - this.points[i * 2 + 1]) * t,
    ];
  }

  private pitLaneAt(fraction: number): [number, number] {
    const L = this.race.lapLength;
    const [x, y] = this.at((-PIT_LANE_SPAN + fraction * 2 * PIT_LANE_SPAN) * L);
    return [
      x + this.pitNormal[0] * PIT_LANE_OFFSET,
      y + this.pitNormal[1] * PIT_LANE_OFFSET,
    ];
  }

  draw(runner: RaceRunner, options: RenderOptions) {
    const { ctx, race } = this;
    if (!this.trackPath) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    this.drawTrack();
    const positions = this.carPositions(runner);
    if (race.trackStatus === "sc") this.drawSafetyCar(runner);

    // Back markers first so the leaders are drawn on top.
    const drawOrder = [...race.order].reverse();
    for (const index of drawOrder)
      this.drawCar(index, positions[index], options);
    this.drawLabels(positions, options);
  }

  private drawTrack() {
    const { ctx, race } = this;
    const path = this.trackPath!;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.strokeStyle =
      race.trackStatus === "green" ? COLORS.trackEdge : COLORS.vscTint;
    ctx.lineWidth = 14;
    ctx.stroke(path);
    ctx.strokeStyle = COLORS.track;
    ctx.lineWidth = 10;
    ctx.stroke(path);
    ctx.strokeStyle = COLORS.centreLine;
    ctx.lineWidth = 1;
    ctx.stroke(path);

    // Standing water: a blue sheen that grows with wetness.
    const wetness = race.weather.wetness;
    if (wetness > 0.02) {
      ctx.strokeStyle = `rgba(80,150,255,${(wetness * 0.45).toFixed(3)})`;
      ctx.lineWidth = 10;
      ctx.stroke(path);
    }

    // Pit lane.
    ctx.beginPath();
    for (let k = 0; k <= 20; k++) {
      const [x, y] = this.pitLaneAt(k / 20);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = COLORS.pitLane;
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    // Start/finish line: a short chequered bar across the track.
    const [x0, y0] = this.at(0);
    const [nx, ny] = this.pitNormal;
    for (let k = -3; k < 3; k++) {
      ctx.fillStyle = k % 2 === 0 ? "#ffffff" : "#111111";
      ctx.fillRect(x0 + nx * k * 2 - 1.5, y0 + ny * k * 2 - 1.5, 3, 3);
    }
  }

  private carPositions(runner: RaceRunner): [number, number][] {
    return this.race.cars.map((car) => {
      if (car.status === "pit") {
        const stop = car.pitStops[car.pitStops.length - 1];
        const total =
          this.race.track.pitLaneLossSeconds + stop.stationarySeconds;
        return this.pitLaneAt(1 - Math.max(0, car.pitTimeLeft) / total);
      }
      return this.at(runner.renderDistance(car.index));
    });
  }

  private drawSafetyCar(runner: RaceRunner) {
    const leader = this.race.cars[this.race.order[0]];
    const [x, y] = this.at(runner.renderDistance(leader.index) + 140);
    const { ctx } = this;
    ctx.fillStyle = COLORS.safetyCar;
    ctx.beginPath();
    ctx.roundRect(x - 9, y - 6, 18, 12, 3);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.font = `bold 8px ${this.mono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SC", x, y + 0.5);
  }

  private drawCar(
    index: number,
    [x, y]: [number, number],
    options: RenderOptions,
  ) {
    const { ctx, race } = this;
    const car = race.cars[index];
    const team: Team = race.team(car);
    const selected = car.driverId === options.selectedDriverId;
    const player = car.teamId === options.playerTeamId;

    ctx.globalAlpha =
      car.status === "retired" ? 0.45 : car.status === "finished" ? 0.7 : 1;
    ctx.beginPath();
    ctx.arc(x, y, CAR_RADIUS + (selected ? 1.5 : 0), 0, Math.PI * 2);
    ctx.fillStyle = car.status === "retired" ? COLORS.retired : team.color;
    ctx.fill();
    ctx.lineWidth = player || selected ? 2.5 : 1.5;
    ctx.strokeStyle = player || selected ? "#ffffff" : "rgba(0,0,0,0.6)";
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** Driver codes above the dots, skipping any that would overlap a more important one. */
  private drawLabels(positions: [number, number][], options: RenderOptions) {
    const { ctx, race } = this;
    ctx.font = `bold 10px ${this.mono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const priority = (index: number) => {
      const car = race.cars[index];
      if (car.driverId === options.selectedDriverId) return -2;
      if (car.teamId === options.playerTeamId) return -1;
      return car.position;
    };
    const indices = race.cars
      .filter((c) => c.status !== "retired")
      .map((c) => c.index)
      .sort((a, b) => priority(a) - priority(b));

    const placed: Rect[] = [];
    for (const index of indices) {
      const car = race.cars[index];
      const [x, y] = positions[index];
      const w = 30;
      const h = 14;
      const gap = CAR_RADIUS + 3;
      // Above, below, right, left: the first spot that doesn't collide wins.
      const candidates: Rect[] = [
        { x: x - w / 2, y: y - gap - h, w, h },
        { x: x - w / 2, y: y + gap, w, h },
        { x: x + gap, y: y - h / 2, w, h },
        { x: x - gap - w, y: y - h / 2, w, h },
      ];
      const free = (r: Rect) =>
        !placed.some(
          (p) =>
            r.x < p.x + p.w &&
            r.x + r.w > p.x &&
            r.y < p.y + p.h &&
            r.y + r.h > p.y,
        );
      let rect = candidates.find(free);
      // Important cars always get a label, even if it has to overlap.
      if (!rect) {
        if (priority(index) >= 0) continue;
        rect = candidates[0];
      }
      placed.push(rect);

      const team = race.team(car);
      ctx.fillStyle = COLORS.label;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 3);
      ctx.fill();
      ctx.fillStyle = team.color;
      ctx.fillRect(rect.x, rect.y + 2, 2, rect.h - 4);
      ctx.fillStyle = COLORS.labelText;
      ctx.fillText(car.code, rect.x + w / 2 + 1, rect.y + h / 2 + 0.5);
    }
  }
}
