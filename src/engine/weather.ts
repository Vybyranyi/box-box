import type { Rng } from "./rng";
import type { WeatherKeyframe, WeatherMode, WeatherState } from "./types";

/** Seconds for a wet track to reach the rain's level, and for a soaked track to dry out. */
const WETTING_TIME = 240;
const DRYING_TIME = 750;

/**
 * Rain intensity over the race, decided up front from its own random stream so the player's
 * choices never change the weather.
 */
export function generateWeather(
  mode: WeatherMode,
  rainProbability: number,
  raceSeconds: number,
  rng: Rng,
): WeatherKeyframe[] {
  const dry: WeatherKeyframe[] = [{ time: 0, rain: 0 }];
  const resolved =
    mode === "auto" ? (rng.chance(rainProbability) ? "mixed" : "dry") : mode;
  if (resolved === "dry") return dry;

  const at = (fraction: number) => fraction * raceSeconds;
  if (resolved === "wet") {
    const frames: WeatherKeyframe[] = [];
    for (let f = 0; f <= 1.0001; f += 0.1)
      frames.push({ time: at(f), rain: rng.range(0.45, 0.95) });
    return frames;
  }

  // Mixed: rain arriving mid-race, a wet start that dries, or a passing shower.
  const roll = rng.next();
  const intensity = rng.range(0.35, 1);
  if (roll < 0.45) {
    const start = rng.range(0.15, 0.65);
    const end = Math.min(1.2, start + rng.range(0.15, 0.5));
    return [
      { time: 0, rain: 0 },
      { time: at(start), rain: 0 },
      { time: at(start + 0.03), rain: intensity },
      { time: at(end), rain: intensity },
      { time: at(end + 0.03), rain: 0 },
    ];
  }
  if (roll < 0.75) {
    const end = rng.range(0.08, 0.4);
    return [
      { time: 0, rain: intensity },
      { time: at(end), rain: intensity * 0.6 },
      { time: at(end + 0.03), rain: 0 },
    ];
  }
  const start = rng.range(0.1, 0.8);
  const length = rng.range(0.05, 0.12);
  return [
    { time: 0, rain: 0 },
    { time: at(start), rain: 0 },
    { time: at(start + 0.02), rain: intensity * 0.8 },
    { time: at(start + length), rain: intensity * 0.8 },
    { time: at(start + length + 0.02), rain: 0 },
  ];
}

export function rainAt(timeline: WeatherKeyframe[], time: number): number {
  if (time <= timeline[0].time) return timeline[0].rain;
  for (let i = 1; i < timeline.length; i++) {
    const a = timeline[i - 1];
    const b = timeline[i];
    if (time <= b.time)
      return (
        a.rain + ((b.rain - a.rain) * (time - a.time)) / (b.time - a.time || 1)
      );
  }
  return timeline[timeline.length - 1].rain;
}

export function initialWeather(timeline: WeatherKeyframe[]): WeatherState {
  const rain = rainAt(timeline, 0);
  return { timeline, rain, wetness: rain };
}

/** Advance rain and track wetness by dt seconds. */
export function updateWeather(
  weather: WeatherState,
  time: number,
  dt: number,
): void {
  weather.rain = rainAt(weather.timeline, time);
  if (weather.rain > weather.wetness) {
    weather.wetness += ((weather.rain - weather.wetness) * dt) / WETTING_TIME;
  } else {
    // Some standing water stays while it drizzles; otherwise the racing line dries steadily.
    const floor = weather.rain * 0.8;
    weather.wetness = Math.max(floor, weather.wetness - dt / DRYING_TIME);
  }
  weather.wetness = Math.min(1, Math.max(0, weather.wetness));
}
