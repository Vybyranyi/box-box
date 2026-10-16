"use client";

import { DriverPortrait } from "@/components/driver-portrait";
import { Button, buttonVariants } from "@/components/ui/button";
import { drivers, getTrack, teams } from "@/data";
import {
  createQualifying,
  QUALI_DT,
  QUALI_PHASES,
  type Difficulty,
  type QualiCommand,
  type QualiEvent,
  type WeatherMode,
} from "@/engine";
import { teamObjective } from "@/game/objective";
import { gridParam } from "@/game/parse-params";
import { qualiFeed, type QualiFeedItem } from "@/game/quali-text";
import { Link } from "@/i18n/navigation";
import { useMsg } from "@/i18n/use-msg";
import { formatRaceTime } from "@/lib/format";
import { DEFAULT_SOUND, SoundBoard, type SoundSettings } from "@/lib/sound";
import { useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Bot,
  Pause,
  Play,
  RotateCcw,
  Target,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { QualiCarCard } from "./quali-car-card";
import { QualiTiming } from "./quali-timing";

export type QualiSetup = {
  trackId: string;
  teamId: string;
  laps?: number;
  weather: WeatherMode;
  difficulty: Difficulty;
  seed: number;
};

/** Session clock speeds: at 8× an 18-minute Q1 takes a little over two minutes. */
const SPEEDS = [2, 4, 8, 16, 32] as const;
type Speed = (typeof SPEEDS)[number];
const UI_REFRESH_MS = 250;
/** Never simulate more than this much real time in one frame (tab switches). */
const MAX_FRAME_SECONDS = 0.25;
const FEED_LENGTH = 60;

/** Playable qualifying: Q1, Q2, Q3 against the clock, then on to the grid. */
export function QualiLive({
  setup,
  query,
}: {
  setup: QualiSetup;
  /** Query string of this weekend (with seed), for the race link. */
  query: string;
}) {
  const t = useTranslations("quali");
  const tTracks = useTranslations("tracks");
  const translate = useMsg();
  const locale = useLocale();
  const [session] = useState(() =>
    createQualifying({
      seed: setup.seed,
      track: getTrack(setup.trackId),
      teams,
      drivers,
      laps: setup.laps,
      weather: setup.weather,
      playerTeamId: setup.teamId,
      difficulty: setup.difficulty,
    }),
  );
  const team = teams.find((x) => x.id === setup.teamId)!;
  const objective = teamObjective(
    teams,
    session.track,
    setup.teamId,
    setup.difficulty,
  );

  const [, setFrame] = useState(0);
  const [paused, setPaused] = useState(true);
  const [speed, setSpeed] = useState<Speed>(8);
  const [feed, setFeed] = useState<QualiFeedItem[]>([]);
  const pending = useRef<QualiFeedItem[]>([]);
  const running = useRef({ paused: true, speed: 8 as Speed });

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

  /** Feed lines, radio and sounds for new session events. */
  const handleEvents = (events: QualiEvent[]) => {
    for (const event of events) {
      const item = qualiFeed(session, event, setup.teamId);
      if (item) {
        pending.current.push(item);
        if (item.radio) sound.radio(translate(item.message), "engineer");
      }
      if (event.type === "flag") sound.play("chequered");
      if (
        event.type === "lap" &&
        session.cars[event.car].teamId === setup.teamId &&
        event.lap.time !== null &&
        event.lap.time === session.cars[event.car].best[event.phase]
      )
        sound.play("fastestLap");
    }
  };
  const onEvents = useEffectEvent(handleEvents);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    let budget = 0;
    const frame = (now: number) => {
      const { paused: isPaused, speed: rate } = running.current;
      if (!isPaused && session.state === "running") {
        budget += Math.min((now - last) / 1000, MAX_FRAME_SECONDS) * rate;
        while (budget >= QUALI_DT && session.state === "running") {
          const events = session.step();
          if (events.length) onEvents(events);
          budget -= QUALI_DT;
        }
      }
      last = now;
      if (now - lastUi > UI_REFRESH_MS) {
        lastUi = now;
        if (pending.current.length) {
          const items = pending.current.reverse();
          pending.current = [];
          setFeed((f) => [...items, ...f].slice(0, FEED_LENGTH));
        }
        setFrame((n) => n + 1);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [session]);

  const setRunning = (run: boolean) => {
    running.current.paused = !run;
    setPaused(!run);
    if (run) sound.unlock();
  };
  const changeSpeed = (s: Speed) => {
    running.current.speed = s;
    setSpeed(s);
  };
  const command = (c: QualiCommand) => {
    sound.unlock();
    session.command(c);
    // Apply it at once, even while paused, so the card reacts.
    const events = session.flush();
    if (events.length) handleEvents(events);
    setFrame((n) => n + 1);
  };
  const nextPhase = () => {
    session.nextPhase();
    setRunning(true);
  };

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === "Space") {
      e.preventDefault();
      if (session.state === "running") setRunning(paused);
    } else if (/^Digit[1-5]$/.test(e.code)) {
      changeSpeed(SPEEDS[Number(e.code.slice(5)) - 1]);
    }
  });
  useEffect(() => {
    const down = (e: KeyboardEvent) => onKey(e);
    const up = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        (e.target as HTMLElement | null)?.closest("button")
      )
        e.preventDefault();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const playerCars = session.cars.filter((c) => c.isPlayer);
  const remaining = Math.max(0, session.duration - session.clock);
  const notStarted =
    session.phase === 0 && session.clock === 0 && session.state === "running";
  const allAuto = playerCars.every((c) => c.auto);
  const results = session.state === "finished" ? session.results() : null;
  const raceHref = `/race?${query}&grid=${gridParam(session.grid())}`;
  const sample =
    playerCars.find((c) => c.eliminatedIn === null) ?? playerCars[0];
  const traffic = session.carsOnTrack();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 p-3">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card px-4 py-2.5">
        <Link
          href="/play"
          className="font-mono text-xs text-muted-foreground uppercase hover:text-foreground"
        >
          {t("changeSetup")}
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg leading-tight font-black uppercase italic">
            {t("title", { track: tTracks(setup.trackId as never) })}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {session.wet ? t("wetSession") : t("drySession")}
          </p>
        </div>
        <div className="flex items-center gap-1" aria-label={t("phase")}>
          {QUALI_PHASES.map((p, i) => (
            <span
              key={p.name}
              className={cn(
                "rounded-md px-2 py-1 font-mono text-xs font-bold",
                i === session.phase
                  ? "bg-primary text-primary-foreground"
                  : i < session.phase
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground",
              )}
            >
              {p.name}
            </span>
          ))}
        </div>
        <span
          className={cn(
            "font-mono text-2xl font-black tabular-nums",
            remaining <= 120 && remaining > 0 && "text-amber-300",
            remaining === 0 && "text-red-400",
          )}
          aria-label={t("clock")}
        >
          {formatRaceTime(remaining)}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!allAuto && session.state !== "finished" && (
            <Button
              variant="secondary"
              size="sm"
              title={t("autoHint")}
              onClick={() => command({ type: "auto" })}
            >
              <Bot /> {t("auto")}
            </Button>
          )}
          <Button
            variant="secondary"
            size="icon"
            onClick={() => {
              const enabled = !soundSettings.enabled;
              setSoundSettings({ ...soundSettings, enabled });
              if (enabled) sound.unlock();
            }}
            aria-label={soundSettings.enabled ? t("soundOff") : t("soundOn")}
          >
            {soundSettings.enabled ? <Volume2 /> : <VolumeX />}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            disabled={session.state !== "running"}
            onClick={() => setRunning(paused)}
            aria-label={paused ? t("resume") : t("pause")}
          >
            {paused ? <Play /> : <Pause />}
          </Button>
          <div className="flex rounded-lg bg-muted p-0.5" role="group">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeSpeed(s)}
                className={cn(
                  "rounded-md px-2 py-1 font-mono text-xs font-bold",
                  speed === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <QualiTiming session={session} playerTeamId={setup.teamId} />

        <aside className="order-first flex flex-col gap-3 lg:order-none">
          {notStarted && paused && (
            <section className="flex flex-col gap-2 rounded-xl border border-primary/60 bg-primary/10 p-3">
              <p className="text-sm font-semibold">{t("introTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("intro")}</p>
              <Button className="font-bold" onClick={() => setRunning(true)}>
                <Play /> {t("start", { phase: "Q1" })}
              </Button>
            </section>
          )}

          {playerCars.map((car) => (
            <QualiCarCard
              key={car.driverId}
              session={session}
              car={car}
              onCommand={command}
            />
          ))}

          <section className="flex flex-col gap-1.5 rounded-xl border bg-card p-3 text-xs">
            <p className="flex items-center gap-1.5 font-semibold">
              <Target className="size-3.5" /> {translate(objective.text)}
            </p>
            <p className="text-muted-foreground">
              {t("trafficNow", {
                cars: traffic,
                chance: Math.round(session.trafficChance() * 100),
              })}
            </p>
            {sample && (
              <p className="text-muted-foreground">
                {t("evolution", {
                  gain: session.evolutionLeft(sample).toFixed(2),
                })}
              </p>
            )}
            <p className="text-muted-foreground">
              {session.phase < 2
                ? t("dropZone", {
                    keep: session.keep,
                    cars: session.active.length,
                  })
                : t("q3")}
            </p>
          </section>

          <section className="flex max-h-72 flex-col overflow-y-auto rounded-xl border bg-card p-3">
            <h2 className="mb-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
              {t("feedTitle")}
            </h2>
            {feed.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("feedEmpty")}</p>
            )}
            <ul className="flex flex-col gap-1 text-xs">
              {feed.map((item) => (
                <li key={item.id} className="flex gap-2">
                  <span className="w-14 shrink-0 font-mono text-muted-foreground">
                    Q{item.phase + 1} {formatRaceTime(item.remaining)}
                  </span>
                  <span
                    className={cn(
                      item.tone === "good" && "text-emerald-400",
                      item.tone === "bad" && "text-amber-300",
                    )}
                  >
                    {translate(item.message)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {session.state === "break" && (
        <Overlay>
          <h2 className="text-2xl font-black uppercase italic">
            {t("phaseOver", { phase: session.phase + 1 })}
          </h2>
          <p className="text-sm text-muted-foreground">{t("knockedOutList")}</p>
          <ul className="flex flex-wrap gap-1.5 font-mono text-sm">
            {session.cars
              .filter((c) => c.eliminatedIn === session.phase)
              .map((c) => (
                <li
                  key={c.driverId}
                  className={cn(
                    "rounded bg-muted px-2 py-0.5",
                    c.isPlayer && "bg-red-500/30 font-bold",
                  )}
                >
                  {c.code}
                </li>
              ))}
          </ul>
          <ul className="flex flex-col gap-1 text-sm">
            {playerCars.map((c) => (
              <li key={c.driverId}>
                <b>{c.code}</b>{" "}
                {c.eliminatedIn === null
                  ? t("through")
                  : t("knockedOut", { phase: c.eliminatedIn + 1 })}
              </li>
            ))}
          </ul>
          <Button size="lg" className="font-bold" onClick={nextPhase}>
            <Play /> {t("start", { phase: `Q${session.phase + 2}` })}
          </Button>
        </Overlay>
      )}

      {results && (
        <Overlay>
          <h2 className="text-2xl font-black uppercase italic">
            {t("finished")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("poleFor", {
              car: drivers.find((d) => d.id === results[0].driverId)!.lastName,
            })}
          </p>
          <div className="flex flex-col gap-2">
            {results
              .filter((r) => r.teamId === setup.teamId)
              .map((r) => {
                const driver = drivers.find((d) => d.id === r.driverId)!;
                return (
                  <div key={r.driverId} className="flex items-center gap-3">
                    <DriverPortrait
                      driver={driver}
                      team={team}
                      className="size-10"
                    />
                    <p className="flex-1 font-semibold">{driver.lastName}</p>
                    <span className="font-mono text-2xl font-black">
                      P{r.position}
                    </span>
                  </div>
                );
              })}
          </div>
          <p className="flex items-center gap-1.5 text-sm">
            <Target className="size-4" /> {translate(objective.text)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={raceHref}
              className={cn(
                buttonVariants({ size: "lg" }),
                "font-bold uppercase",
              )}
            >
              {t("toGrid")} <ArrowRight />
            </Link>
            <a
              href={`/${locale}/qualifying?${query}`}
              className={buttonVariants({ size: "lg", variant: "secondary" })}
            >
              <RotateCcw /> {t("again")}
            </a>
          </div>
        </Overlay>
      )}
    </main>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border bg-card p-5 shadow-2xl">
        {children}
      </div>
    </div>
  );
}
