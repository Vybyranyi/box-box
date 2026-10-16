"use client";

import { drivers, getTrack, teams } from "@/data";
import type {
  Compound,
  Race,
  RaceCommand,
  TimedEvent,
  WeatherMode,
} from "@/engine";
import { alertFor, type RaceAlert } from "@/game/alerts";
import { saveToHistory } from "@/game/history";
import { gradeRace } from "@/game/objective";
import { DEFAULT_SETTINGS, type Settings } from "@/game/race-options";
import { useStored } from "@/lib/storage";
import { useTranslations } from "next-intl";
import { describeEvent, ENGINEER, type FeedItem } from "@/game/event-text";
import { msg, tyresPlural, type Msg } from "@/game/messages";
import { recommendedCompound } from "@/game/pit-wall";
import { boxCalls } from "@/game/insights";
import { radioFor } from "@/game/radio";
import { RaceRunner, SPEEDS, type Speed } from "@/game/race-runner";
import { buildTower } from "@/game/tower";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { PitWall } from "./pit-wall";
import { RaceAlertBanner } from "./race-alert";
import { RaceFeed } from "./race-feed";
import { RaceHeader } from "./race-header";
import { FastestLap, RaceInfo } from "./race-info";
import { RaceResults } from "./race-results";
import { StartOverlay } from "./start-overlay";
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
const FEED_LENGTH = 120;
function createRunner(
  setup: RaceSetup,
  startingTyres?: Record<string, Compound>,
) {
  return new RaceRunner({
    seed: setup.seed,
    track: getTrack(setup.trackId),
    teams,
    drivers,
    laps: setup.laps,
    weather: setup.weather,
    playerTeamId: setup.playerTeamId,
    startingTyres,
  });
}

function feedItems(
  race: Race,
  events: TimedEvent[],
  teamId: string | null,
): FeedItem[] {
  return events.flatMap((e) =>
    [describeEvent(race, e), radioFor(race, e, teamId)].filter(
      (x) => x !== null,
    ),
  );
}

export function RaceView({ setup }: { setup: RaceSetup }) {
  const t = useTranslations();
  const teamId = setup.playerTeamId;
  const [runner, setRunner] = useState(() => {
    const r = createRunner(setup);
    // With a team to run, wait on the grid for the starting-tyre choice.
    if (teamId) r.setPaused(true);
    return r;
  });
  const race = runner.race;

  const [started, setStarted] = useState(!teamId);
  const [, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [settings, setSettings] = useStored<Settings>(
    "settings",
    DEFAULT_SETTINGS,
  );
  const autoPause = settings.autoPause;
  const [showResults, setShowResults] = useState(false);
  const finishHandled = useRef(false);
  const [alert, setAlert] = useState<RaceAlert | null>(null);
  const [selected, setSelected] = useState<string>(() => {
    const own = race.cars
      .filter((c) => c.isPlayer)
      .sort((a, b) => a.gridPosition - b.gridPosition)[0];
    return (own ?? race.cars[race.order[0]]).driverId;
  });
  const [feed, setFeed] = useState<FeedItem[]>(() =>
    feedItems(race, race.events, teamId).reverse(),
  );

  const pendingFeed = useRef<FeedItem[]>([]);
  const pendingAlert = useRef<RaceAlert | null>(null);
  const localMessageId = useRef(-1);
  const boxCallsMade = useRef(new Set<string>());

  const drawRef = useRef<(() => void) | null>(null);
  const register = useCallback((draw: (() => void) | null) => {
    drawRef.current = draw;
  }, []);

  /** A radio message from our race engineer that the engine didn't produce. */
  const engineerRadio = (message: Msg): FeedItem => ({
    id: localMessageId.current--,
    lap: Math.min(race.leaderLap + 1, race.laps),
    message,
    tone: "info",
    kind: "radio",
    from: ENGINEER,
    color: teamId ? teams.find((x) => x.id === teamId)?.color : undefined,
  });

  // Engine events → feed, radio and (optionally) an auto-pause decision prompt.
  const onRaceEvents = useEffectEvent((events: TimedEvent[]) => {
    pendingFeed.current.push(...feedItems(race, events, teamId));
    if (teamId)
      for (const call of boxCalls(race, teamId, boxCallsMade.current))
        pendingFeed.current.push(engineerRadio(call));
    if (!autoPause) return;
    for (const event of events) {
      const next = alertFor(race, event, teamId);
      if (next) {
        pendingAlert.current = next;
        runner.setPaused(true);
      }
    }
  });
  useEffect(() => runner.onEvents((events) => onRaceEvents(events)), [runner]);

  // Chequered flag: grade the race, store it in the history and show the results.
  const onFinished = useEffectEvent(() => {
    if (teamId) {
      const report = gradeRace(race, teamId);
      saveToHistory({
        id: `${setup.seed}-${setup.trackId}-${teamId}-${race.laps}-${setup.weather}`,
        date: new Date().toISOString(),
        trackId: setup.trackId,
        teamId,
        laps: race.laps,
        weather: setup.weather,
        seed: setup.seed,
        grade: report.grade,
        score: report.score,
        points: report.points,
        objective: report.objective.text.key,
        met: report.met,
        finishes: report.results.map((r) => ({
          code: r.code,
          result:
            r.status === "dnf"
              ? "DNF"
              : r.status === "dsq"
                ? "DSQ"
                : `P${r.position}`,
        })),
      });
    }
    setShowResults(true);
  });

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const frame = (now: number) => {
      runner.advance((now - last) / 1000);
      last = now;
      drawRef.current?.();
      if (runner.race.finished && !finishHandled.current) {
        finishHandled.current = true;
        onFinished();
      }
      if (now - lastUi > UI_REFRESH_MS || pendingAlert.current) {
        lastUi = now;
        if (pendingFeed.current.length) {
          const items = pendingFeed.current.reverse();
          pendingFeed.current = [];
          setFeed((f) => [...items, ...f].slice(0, FEED_LENGTH));
        }
        if (pendingAlert.current) {
          setAlert(pendingAlert.current);
          setPaused(true);
          pendingAlert.current = null;
        }
        setFrame((n) => n + 1);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [runner]);

  const setRunning = (running: boolean) => {
    runner.setPaused(!running);
    setPaused(!running);
  };
  const togglePause = () => {
    if (!started || race.finished) return;
    if (paused) setAlert(null);
    setRunning(paused);
  };
  const changeSpeed = (s: Speed) => {
    runner.setSpeed(s);
    setSpeed(s);
  };
  const dismissAlert = () => {
    setAlert(null);
    setRunning(true);
  };

  const pushLocalRadio = (message: Msg) => {
    const item = engineerRadio(message);
    setFeed((f) => [item, ...f].slice(0, FEED_LENGTH));
  };

  const issueCommand = (command: RaceCommand) => {
    // Before the start the runner is rebuilt with the chosen tyres, so commands would be lost.
    if (!started) return;
    race.command(command);
    if (command.type === "pit") {
      const car = race.carByDriver(command.driverId);
      if (car)
        pushLocalRadio(
          msg("radio.boxBox", {
            car: car.code,
            compound: tyresPlural(command.compound),
          }),
        );
    } else if (command.type === "cancel-pit") {
      pushLocalRadio(msg("radio.cancelStop"));
    } else if (command.type === "team-order" && command.order !== "free") {
      pushLocalRadio(
        msg(command.order === "swap" ? "radio.orderSwap" : "radio.orderHold"),
      );
    }
  };

  const start = (tyres: Record<string, Compound>) => {
    // Same seed, same grid and weather: only the starting tyres change.
    const next = createRunner(setup, tyres);
    next.setSpeed(speed);
    pendingFeed.current = [];
    boxCallsMade.current.clear();
    setFeed(feedItems(next.race, next.race.events, teamId).reverse());
    setRunner(next);
    setStarted(true);
    setPaused(false);
  };

  const playerCars = race.cars
    .filter((c) => c.isPlayer)
    .sort((a, b) => a.position - b.position);

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      e.metaKey ||
      e.ctrlKey ||
      e.altKey ||
      target?.closest("input, textarea, select, [contenteditable]")
    )
      return;
    if (e.code === "Space") {
      e.preventDefault();
      if (alert) dismissAlert();
      else togglePause();
    } else if (e.code === "Escape" && alert) {
      dismissAlert();
    } else if (/^Digit[1-5]$/.test(e.code)) {
      changeSpeed(SPEEDS[Number(e.code.slice(5)) - 1]);
    } else if (e.code === "KeyQ" || e.code === "KeyE") {
      const car = playerCars[e.code === "KeyQ" ? 0 : 1];
      if (car) setSelected(car.driverId);
    } else if (e.code === "KeyB" && started) {
      const car =
        playerCars.find((c) => c.driverId === selected) ??
        playerCars.find((c) => c.status === "racing");
      if (!car || car.status !== "racing") return;
      if (car.pitRequest)
        issueCommand({ type: "cancel-pit", driverId: car.driverId });
      else
        issueCommand({
          type: "pit",
          driverId: car.driverId,
          compound: recommendedCompound(race, car),
        });
    }
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const options = useMemo(
    () => ({ selectedDriverId: selected, playerTeamId: teamId }),
    [selected, teamId],
  );
  const rows = buildTower(race);
  const selectedCar = race.carByDriver(selected) ?? null;

  return (
    <main className="flex min-h-dvh flex-col gap-3 p-3 lg:h-dvh">
      <RaceHeader
        trackName={t(`tracks.${race.track.id}` as never)}
        circuitName={race.track.circuitName}
        raceTime={race.time}
        status={race.finished ? "finished" : race.trackStatus}
        wetness={race.weather.wetness}
        raining={race.weather.rain > 0.05}
        paused={paused || !started}
        speed={speed}
        onTogglePause={togglePause}
        onSpeed={changeSpeed}
        autoPause={
          teamId
            ? {
                enabled: autoPause,
                onToggle: () =>
                  setSettings({ ...settings, autoPause: !autoPause }),
              }
            : undefined
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[19rem_minmax(0,1fr)_21rem]">
        <div className="min-h-0 overflow-y-auto">
          <TimingTower
            rows={rows}
            lap={race.leaderLap}
            totalLaps={race.laps}
            selectedDriverId={selected}
            onSelect={setSelected}
          />
        </div>
        <div className="relative order-first h-[55vh] min-h-0 overflow-hidden rounded-xl border bg-card lg:order-none lg:h-auto">
          <TrackMap runner={runner} options={options} register={register} />
          {!started && teamId && (
            <StartOverlay race={race} teamId={teamId} onStart={start} />
          )}
          {alert && (
            <RaceAlertBanner
              race={race}
              alert={alert}
              onCommand={issueCommand}
              onDismiss={dismissAlert}
            />
          )}
          {race.finished && !showResults && (
            <button
              type="button"
              onClick={() => setShowResults(true)}
              className="absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground uppercase shadow-lg"
            >
              {t("race.results")}
            </button>
          )}
          {paused && !alert && started && !race.finished && (
            <p className="absolute top-3 left-1/2 -translate-x-1/2 rounded-md bg-background/90 px-3 py-1 font-mono text-xs font-bold uppercase">
              {t("race.paused")}
            </p>
          )}
          {teamId && (
            <p className="absolute bottom-2 left-3 hidden font-mono text-[10px] text-muted-foreground lg:block">
              {t("race.hotkeys")}
            </p>
          )}
        </div>
        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {teamId ? (
            <>
              <PitWall
                race={race}
                teamId={teamId}
                selectedDriverId={selected}
                onSelect={setSelected}
                onCommand={issueCommand}
              />
              <FastestLap race={race} />
            </>
          ) : (
            <RaceInfo race={race} car={selectedCar} />
          )}
          <div className="flex min-h-64 flex-1 flex-col">
            <RaceFeed feed={feed} />
          </div>
        </aside>
      </div>
      {showResults && (
        <RaceResults
          race={race}
          teamId={teamId}
          onClose={() => setShowResults(false)}
        />
      )}
    </main>
  );
}
