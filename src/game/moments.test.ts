import { drivers, getTrack, teams } from "@/data";
import { createRace, type Race } from "@/engine";
import { describe, expect, it } from "vitest";
import { boxNow } from "./insights";
import { MAX_MOMENTS, MomentLog } from "./moments";
import { recommendedCompound } from "./pit-wall";

const raceAt = (seed: number, trackId = "silverstone") =>
  createRace({
    seed,
    track: getTrack(trackId),
    teams,
    drivers,
    weather: "dry",
    laps: 30,
    playerTeamId: "alpine",
  });

function play(race: Race, log: MomentLog, onLap?: () => void) {
  let lap = -1;
  while (!race.finished) {
    race.step();
    log.observe(race);
    if (race.leaderLap !== lap) {
      lap = race.leaderLap;
      onLap?.();
    }
  }
  return log.finish(race);
}

describe("key moments", () => {
  it("returns a few moments in race order", () => {
    for (const seed of [1, 2, 3]) {
      const race = raceAt(seed);
      const moments = play(race, new MomentLog("alpine"), () => {
        for (const car of race.cars.filter((c) => c.isPlayer))
          if (boxNow(race, car))
            race.command({
              type: "pit",
              driverId: car.driverId,
              compound: recommendedCompound(race, car),
            });
      });
      expect(moments.length).toBeLessThanOrEqual(MAX_MOMENTS);
      for (let i = 1; i < moments.length; i++)
        expect(moments[i].lap).toBeGreaterThanOrEqual(moments[i - 1].lap);
      for (const m of moments) expect(m.message.key).toMatch(/^moments\./);
    }
  });

  it("calls out tyres run far too long", () => {
    const race = raceAt(2);
    const moments = play(race, new MomentLog("alpine"));
    expect(moments.some((m) => m.message.key === "moments.tyresTooLong")).toBe(
      true,
    );
  });

  it("credits a stop under the Safety Car", () => {
    let found = false;
    for (let seed = 1; seed <= 30 && !found; seed++) {
      const race = createRace({
        seed,
        track: getTrack("marina_bay"),
        teams,
        drivers,
        weather: "dry",
        laps: 31,
        playerTeamId: "alpine",
      });
      const log = new MomentLog("alpine");
      while (!race.finished) {
        race.step();
        log.observe(race);
        if (race.trackStatus === "sc")
          for (const car of race.cars.filter(
            (c) => c.isPlayer && c.status === "racing" && !c.pitRequest,
          ))
            if (race.laps - car.lap > 5 && car.pitStops.length === 0)
              race.command({
                type: "pit",
                driverId: car.driverId,
                compound: "hard",
              });
      }
      found = log
        .finish(race)
        .some((m) => m.message.key === "moments.scStop" && m.tone === "good");
    }
    expect(found).toBe(true);
  });
});
