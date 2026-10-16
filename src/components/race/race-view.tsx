"use client";

import { drivers, getTrack, teams } from "@/data";
import type { TimedEvent, WeatherMode } from "@/engine";
import { describeEvent, type FeedItem } from "@/game/event-text";
import { RaceRunner, type Speed } from "@/game/race-runner";
import { buildTower } from "@/game/tower";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RaceHeader } from "./race-header";
import { RaceInfo } from "./race-info";
import { TimingTower } from "./timing-tower";
import { TrackMap } from "./track-map";

export type RaceSetup = {
  trackId: string;
  seed: number;
  playerTeamId: string | null;
  laps?: number;
  weather: WeatherMode;
};

/** How often the React side (tower, panels) refreshes; the map redraws every frame. */
const UI_REFRESH_MS = 250;
const FEED_LENGTH = 80;

export function RaceView({ setup }: { setup: RaceSetup }) {
  const [runner] = useState(
    () =>
      new RaceRunner({
        seed: setup.seed,
        track: getTrack(setup.trackId),
        teams,
        drivers,
        laps: setup.laps,
        weather: setup.weather,
        playerTeamId: setup.playerTeamId,
      }),
  );
  const race = runner.race;

  const [, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [selected, setSelected] = useState<string>(() => {
    const own = race.cars.find((c) => c.isPlayer);
    return (own ?? race.cars[race.order[0]]).driverId;
  });

  const toFeed = useCallback(
    (events: TimedEvent[]) =>
      events.flatMap((e) => describeEvent(race, e) ?? []),
    [race],
  );
  const [feed, setFeed] = useState<FeedItem[]>(() =>
    toFeed(race.events).reverse(),
  );
  const pendingFeed = useRef<FeedItem[]>([]);

  const drawRef = useRef<(() => void) | null>(null);
  const register = useCallback((draw: (() => void) | null) => {
    drawRef.current = draw;
  }, []);

  useEffect(
    () =>
      runner.onEvents((events) => pendingFeed.current.push(...toFeed(events))),
    [runner, toFeed],
  );

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const frame = (now: number) => {
      runner.advance((now - last) / 1000);
      last = now;
      drawRef.current?.();
      if (now - lastUi > UI_REFRESH_MS) {
        lastUi = now;
        if (pendingFeed.current.length) {
          const items = pendingFeed.current.reverse();
          pendingFeed.current = [];
          setFeed((f) => [...items, ...f].slice(0, FEED_LENGTH));
        }
        setFrame((n) => n + 1);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [runner]);

  const togglePause = () => {
    runner.setPaused(!paused);
    setPaused(!paused);
  };
  const changeSpeed = (s: Speed) => {
    runner.setSpeed(s);
    setSpeed(s);
  };

  const options = useMemo(
    () => ({ selectedDriverId: selected, playerTeamId: setup.playerTeamId }),
    [selected, setup.playerTeamId],
  );
  const rows = buildTower(race);
  const selectedCar = race.carByDriver(selected) ?? null;

  return (
    <main className="flex min-h-dvh flex-col gap-3 p-3 lg:h-dvh">
      <RaceHeader
        trackName={race.track.name}
        circuitName={race.track.circuitName}
        raceTime={race.time}
        status={race.finished ? "finished" : race.trackStatus}
        wetness={race.weather.wetness}
        raining={race.weather.rain > 0.05}
        paused={paused}
        speed={speed}
        onTogglePause={togglePause}
        onSpeed={changeSpeed}
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[19rem_minmax(0,1fr)_19rem]">
        <div className="min-h-0 overflow-y-auto lg:order-none">
          <TimingTower
            rows={rows}
            lap={race.leaderLap}
            totalLaps={race.laps}
            selectedDriverId={selected}
            onSelect={setSelected}
          />
        </div>
        <div className="order-first h-[55vh] min-h-0 overflow-hidden rounded-xl border bg-card lg:order-none lg:h-auto">
          <TrackMap runner={runner} options={options} register={register} />
        </div>
        <aside className="flex min-h-0 flex-col">
          <RaceInfo race={race} car={selectedCar} feed={feed} />
        </aside>
      </div>
    </main>
  );
}
