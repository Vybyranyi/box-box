import { DriverPortrait } from "@/components/driver-portrait";
import { RemoteImage } from "@/components/remote-image";
import { TrackOutline } from "@/components/track-outline";
import { calendar, getTeamDrivers, getTrack, meta, teams } from "@/data";
import { getTeamImage } from "@/data/images";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Data preview · Box Box" };

const formatLap = (s: number) =>
  `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, "0")}`;

/** Developer preview of the generated data. Replaced by real screens in later stages. */
export default function DataPreviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 py-10">
      <header>
        <h1 className="text-4xl font-black uppercase italic">Data preview</h1>
        <p className="font-mono text-sm text-muted-foreground">
          Season {meta.season} · after round {meta.lastCompletedRound} ·
          generated {meta.generatedAt.slice(0, 10)}
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((team) => (
          <article
            key={team.id}
            className="flex flex-col gap-4 rounded-xl border bg-card p-4"
            style={{ borderTopColor: team.color, borderTopWidth: 4 }}
          >
            <div className="flex items-center gap-3">
              <RemoteImage
                src={getTeamImage(team, "logo", 96)}
                alt={`${team.shortName} logo`}
                className="size-8 object-contain"
                fallback={
                  <span
                    className="size-8 rounded-full"
                    style={{ background: team.color }}
                  />
                }
              />
              <div className="flex-1">
                <h2 className="font-bold uppercase">{team.shortName}</h2>
                <p className="text-xs text-muted-foreground">
                  {team.powerUnit} power unit
                </p>
              </div>
              <span className="font-mono text-sm">
                P{team.championship.position} · {team.championship.points} pts
              </span>
            </div>

            <RemoteImage
              src={getTeamImage(team, "car", 800)}
              alt={`${team.shortName} car`}
              className="h-20 w-full object-contain"
              fallback={<div className="h-20" />}
            />

            <dl className="grid grid-cols-4 gap-2 font-mono text-xs">
              <Stat
                label="Gap"
                value={`+${team.car.paceDeficitPct.toFixed(2)}%`}
              />
              <Stat label="Power" value={signed(team.car.powerTrackDeltaPct)} />
              <Stat
                label="Downf."
                value={signed(team.car.downforceTrackDeltaPct)}
              />
              <Stat
                label="Reliab."
                value={`${Math.round(team.car.reliability * 100)}%`}
              />
            </dl>

            <div className="grid grid-cols-2 gap-3">
              {getTeamDrivers(team.id).map((driver) => (
                <div
                  key={driver.id}
                  className="flex flex-col items-center gap-2 text-center"
                >
                  <DriverPortrait
                    driver={driver}
                    team={team}
                    className="size-20"
                  />
                  <div>
                    <p className="text-sm font-semibold">
                      {driver.firstName}{" "}
                      <span className="uppercase">{driver.lastName}</span>
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      #{driver.number} · {driver.code} ·{" "}
                      {driver.championship.points} pts
                    </p>
                  </div>
                  <dl className="grid w-full grid-cols-5 gap-1 font-mono text-[10px]">
                    <Stat label="PAC" value={driver.ratings.pace} />
                    <Stat label="RCR" value={driver.ratings.racecraft} />
                    <Stat label="TYR" value={driver.ratings.tyreManagement} />
                    <Stat label="WET" value={driver.ratings.wetSkill} />
                    <Stat label="CON" value={driver.ratings.consistency} />
                  </dl>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-black uppercase italic">Calendar</h2>
        <p className="text-sm text-muted-foreground">
          Red dot: start/finish line. Yellow dot: a little way into the lap,
          showing race direction.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {calendar.map((round) => {
            const track = getTrack(round.trackId);
            return (
              <article
                key={round.round}
                className="flex flex-col gap-2 rounded-xl border bg-card p-4"
              >
                <p className="font-mono text-xs text-muted-foreground">
                  R{round.round} · {round.date}
                </p>
                <h3 className="font-bold uppercase">{track.name}</h3>
                <TrackOutline track={track} className="aspect-square w-full" />
                <dl className="grid grid-cols-3 gap-1 font-mono text-[10px]">
                  <Stat label="Laps" value={track.laps} />
                  <Stat
                    label="Km"
                    value={(track.lengthMeters / 1000).toFixed(3)}
                  />
                  <Stat label="Pit" value={`${track.pitLaneLossSeconds}s`} />
                  <Stat label="Pole" value={formatLap(track.poleTimeSeconds)} />
                  <Stat label="Deg" value={`${track.tyreDegradation}/5`} />
                  <Stat label="Ovt" value={`${track.overtakingDifficulty}/5`} />
                </dl>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function signed(x: number) {
  return `${x > 0 ? "+" : ""}${x.toFixed(2)}`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded bg-muted px-1.5 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
