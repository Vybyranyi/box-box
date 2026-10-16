"use client";

import { drivers, getTrack, teams } from "@/data";
import type {
  Compound,
  Race,
  RaceCommand,
  TimedEvent,
  Difficulty,
  WeatherMode,
} from "@/engine";
import { alertFor, type RaceAlert } from "@/game/alerts";
import { saveToHistory } from "@/game/history";
import { gradeRace } from "@/game/objective";
import { DEFAULT_SETTINGS, type Settings } from "@/game/race-options";
import { DEFAULT_SOUND, SoundBoard, type SoundSettings } from "@/lib/sound";
import { useStored } from "@/lib/storage";
import { useLocale, useTranslations } from "next-intl";
import { describeEvent, ENGINEER, type FeedItem } from "@/game/event-text";
import { msg, tyresPlural, type Msg } from "@/game/messages";
import { recommendedCompound } from "@/game/pit-wall";
import { boxCalls } from "@/game/insights";
import { MomentLog, type Moment } from "@/game/moments";
import { RadioRequests, type RadioRequest } from "@/game/radio-requests";
import { cuesFor } from "@/game/sound-cues";
import { useMsg } from "@/i18n/use-msg";
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
  difficulty: Difficulty;
};

/** How often the React side (tower, panels) refreshes; the map redraws every frame. */
const UI_REFRESH_MS = 250;
/** How long a timing tower row flashes after a pass, ms. */
const FLASH_MS = 1400;
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
    difficulty: setup.difficulty,
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
  const locale = useLocale();
  const translateMsg = useMsg();
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
  const requests = useRef(new RadioRequests());
  const [openRequests, setOpenRequests] = useState<readonly RadioRequest[]>([]);
  const momentLog = useRef<MomentLog | null>(null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const flashTimes = useRef(
    new Map<string, { dir: "up" | "down"; at: number }>(),
  );
  const [flashes, setFlashes] = useState<Record<string, "up" | "down">>({});

  const [soundSettings, setSoundSettings] = useStored<SoundSettings>(
    "sound",
    DEFAULT_SOUND,
  );
  const [sound] = useState(() => new SoundBoard());
  useEffect(() => () => sound.dispose(), [sound]);
  useEffect(
    () => sound.configure(soundSettings, locale),
    [sound, soundSettings, locale],
  );
  // Browsers only allow audio after a gesture: unlock on the first click or key press.
  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [sound]);

  const playRadio = (items: FeedItem[]) => {
    for (const item of items)
      if (item.kind === "radio")
        sound.radio(
          translateMsg(item.message),
          item.from === ENGINEER ? "engineer" : "driver",
        );
  };

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

  /** A driver asking for something on the radio. */
  const driverRadio = (request: RadioRequest): FeedItem => {
    const car = race.carByDriver(request.driverId)!;
    return {
      id: localMessageId.current--,
      lap: Math.min(race.leaderLap + 1, race.laps),
      message: request.message,
      tone: "info",
      kind: "radio",
      from: car.code,
      color: race.team(car).color,
    };
  };

  // Engine events → feed, radio, sounds, driver requests and (optionally) an auto-pause prompt.
  const onRaceEvents = useEffectEvent((events: TimedEvent[]) => {
    const items = feedItems(race, events, teamId);
    if (teamId) {
      for (const call of boxCalls(race, teamId, boxCallsMade.current))
        items.push(engineerRadio(call));
      for (const request of requests.current.update(race, teamId))
        items.push(driverRadio(request));
      momentLog.current?.observe(race);
    }
    pendingFeed.current.push(...items);
    playRadio(items);
    for (const cue of cuesFor(race, events, teamId)) sound.play(cue);

    const now = performance.now();
    for (const e of events)
      if (e.type === "overtake") {
        flashTimes.current.set(race.cars[e.car].driverId, {
          dir: "up",
          at: now,
        });
        flashTimes.current.set(race.cars[e.on].driverId, {
          dir: "down",
          at: now,
        });
      }

    if (!autoPause) return;
    for (const event of events) {
      const next = alertFor(race, event, teamId);
      if (next) {
        pendingAlert.current = next;
        runner.setPaused(true);
        sound.alert();
      }
    }
  });

  /** Refresh the React-side copies of the open requests and the tower flashes. */
  const syncOverlays = useEffectEvent((now: number) => {
    const active = requests.current.active;
    if (
      active.length !== openRequests.length ||
      active.some((r, i) => r.id !== openRequests[i]?.id)
    )
      setOpenRequests([...active]);
    const next: Record<string, "up" | "down"> = {};
    for (const [driverId, flash] of flashTimes.current) {
      if (now - flash.at < FLASH_MS) next[driverId] = flash.dir;
      else flashTimes.current.delete(driverId);
    }
    if (Object.keys(next).join() !== Object.keys(flashes).join())
      setFlashes(next);
  });
  useEffect(() => runner.onEvents((events) => onRaceEvents(events)), [runner]);

  // Chequered flag: grade the race, store it in the history and show the results.
  const onFinished = useEffectEvent(() => {
    if (teamId) {
      setMoments(momentLog.current?.finish(race) ?? []);
      const report = gradeRace(race, teamId);
      saveToHistory({
        id: `${setup.seed}-${setup.trackId}-${teamId}-${race.laps}-${setup.weather}-${setup.difficulty}`,
        date: new Date().toISOString(),
        trackId: setup.trackId,
        teamId,
        laps: race.laps,
        weather: setup.weather,
        difficulty: setup.difficulty,
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
        syncOverlays(now);
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
    playRadio([item]);
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

  /** The player's answer to a driver's radio request. */
  const answerRequest = (id: string, yes: boolean) => {
    const request = requests.current.answer(id);
    setOpenRequests(requests.current.active.slice());
    if (!request) return;
    if (!yes) return pushLocalRadio(request.noReply);
    // Pit stops and team orders get their own radio call; pushing gets the reply.
    for (const command of request.yes) issueCommand(command);
    if (request.kind === "push") pushLocalRadio(request.yesReply);
  };

  const start = (tyres: Record<string, Compound>) => {
    // Same seed, same grid and weather: only the starting tyres change.
    const next = createRunner(setup, tyres);
    next.setSpeed(speed);
    pendingFeed.current = [];
    boxCallsMade.current.clear();
    requests.current = new RadioRequests();
    setOpenRequests([]);
    momentLog.current = teamId ? new MomentLog(teamId) : null;
    sound.unlock();
    sound.play("lightsOut");
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
    } else if ((e.code === "KeyY" || e.code === "KeyN") && openRequests[0]) {
      answerRequest(openRequests[0].id, e.code === "KeyY");
    } else if ((e.code === "KeyO" || e.code === "KeyD") && started) {
      const car = playerCars.find((c) => c.driverId === selected);
      if (car)
        issueCommand({
          type: "boost",
          driverId: car.driverId,
          kind: e.code === "KeyO" ? "attack" : "defend",
        });
    }
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e);
    // Space is the pause key: don't let it also press whichever button has focus (browsers
    // activate a focused button when Space is released).
    const keyUp = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        (e.target as HTMLElement | null)?.closest("button")
      )
        e.preventDefault();
    };
    window.addEventListener("keydown", listener);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", listener);
      window.removeEventListener("keyup", keyUp);
    };
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
        sound={{
          enabled: soundSettings.enabled,
          voice: soundSettings.voice,
          onToggle: () => {
            const enabled = !soundSettings.enabled;
            setSoundSettings({ ...soundSettings, enabled });
            if (enabled) sound.unlock();
          },
          onToggleVoice: () =>
            setSoundSettings({ ...soundSettings, voice: !soundSettings.voice }),
        }}
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
            flashes={flashes}
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
                requests={openRequests}
                onAnswer={answerRequest}
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
          moments={moments}
          onClose={() => setShowResults(false)}
        />
      )}
    </main>
  );
}
