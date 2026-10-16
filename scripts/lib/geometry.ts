import type { Point } from "../../src/data/types";

/** [longitude, latitude] as in GeoJSON. */
export type LonLat = [number, number];

const METERS_PER_DEG_LAT = 110_540;
const METERS_PER_DEG_LON_AT_EQUATOR = 111_320;

/** Equirectangular projection to local metres around the centroid (x east, y north). */
export function projectToMeters(coords: LonLat[]): Point[] {
  const lon0 = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lat0 = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  const kx = METERS_PER_DEG_LON_AT_EQUATOR * Math.cos((lat0 * Math.PI) / 180);
  return coords.map(([lon, lat]) => [
    (lon - lon0) * kx,
    (lat - lat0) * METERS_PER_DEG_LAT,
  ]);
}

/** Drop trailing points that (nearly) repeat the first point, which would make a tiny loop. */
export function openRing(points: Point[]): Point[] {
  const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const segments = points.slice(1).map((p, i) => dist(points[i], p));
  const typical = [...segments].sort((a, b) => a - b)[segments.length >> 1];
  const out = [...points];
  while (out.length > 3 && dist(out[out.length - 1], out[0]) < typical / 2)
    out.pop();
  return out;
}

/**
 * Round off the polyline's corners: resample densely and evenly, then apply a closed moving
 * average. Unlike a spline through unevenly spaced points, this never overshoots or makes loops.
 */
export function smoothClosed(
  points: Point[],
  spacingMeters = 5,
  window = 7,
  passes = 2,
): Point[] {
  let out = resampleClosed(
    points,
    Math.max(8, Math.round(closedLength(points) / spacingMeters)),
  );
  const half = Math.floor(window / 2);
  for (let pass = 0; pass < passes; pass++) {
    const n = out.length;
    out = out.map((_, i) => {
      let x = 0;
      let y = 0;
      for (let k = -half; k <= half; k++) {
        const p = out[(i + k + n) % n];
        x += p[0];
        y += p[1];
      }
      return [x / window, y / window];
    });
  }
  return out;
}

export function closedLength(points: Point[]): number {
  let len = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    len += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return len;
}

/** Shoelace signed area: positive when the points wind anticlockwise (x east, y north). */
export function signedArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

/** Resample a closed polyline into `count` points evenly spaced by arc length. */
export function resampleClosed(points: Point[], count: number): Point[] {
  const total = closedLength(points);
  const step = total / count;
  const out: Point[] = [points[0]];
  let target = step;
  let travelled = 0;
  for (let i = 0; i < points.length && out.length < count; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (travelled + seg >= target && out.length < count) {
      const t = (target - travelled) / seg;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      target += step;
    }
    travelled += seg;
  }
  return out;
}

/** Scale points uniformly so the closed length matches `lengthMeters`. */
export function scaleToLength(points: Point[], lengthMeters: number): Point[] {
  const k = lengthMeters / closedLength(points);
  return points.map(([x, y]) => [x * k, y * k]);
}

export function roundPoints(points: Point[], decimals = 1): Point[] {
  const m = 10 ** decimals;
  return points.map(([x, y]) => [Math.round(x * m) / m, Math.round(y * m) / m]);
}

/** Great-circle distance in metres. */
export function haversine([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
  const r = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}
