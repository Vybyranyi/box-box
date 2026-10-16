import { drivers, getTrack, teams } from "@/data";
import { describe, expect, it } from "vitest";
import { createRace, type Race } from "./race";
import type { RaceConfig } from "./types";

const monza = getTrack("monza");
const base: RaceConfig = {
  seed: 42,
  track: monza,
  teams,
  drivers,
  weather: "dry",
};

/** Step until the predicate holds (or the race ends). */
function runUntil(race: Race, done: () => boolean) {
  while (!race.finished && !done()) race.step();
}

describe("race", () => {
  it("runs a full race to the chequered flag", () => {
    const race = createRace(base);
    const results = race.run();
    expect(race.finished).toBe(true);
    expect(results).toHaveLength(22);
    expect(results[0].laps).toBe(monza.laps);
    expect(results[0].status).toBe("finished");
    expect(results.map((r) => r.position)).toEqual(
      Array.from({ length: 22 }, (_, i) => i + 1),
    );
    expect(results.reduce((s, r) => s + r.points, 0)).toBeLessThanOrEqual(101);
    // Finishers are ordered by laps, then by time.
    const finishers = results.filter((r) => r.status === "finished");
    for (let i = 1; i < finishers.length; i++)
      expect(finishers[i].gap!).toBeGreaterThanOrEqual(finishers[i - 1].gap!);
  });

  it("is deterministic for the same seed and commands", () => {
    const play = () => {
      const race = createRace({ ...base, playerTeamId: "mclaren" });
      for (let i = 0; i < 2000; i++) race.step();
      race.command({ type: "pit", driverId: "norris", compound: "hard" });
      race.command({ type: "pace", driverId: "piastri", mode: "push" });
      return { results: race.run(), events: race.events.length };
    };
    expect(play()).toEqual(play());
  });

  it("produces different races for different seeds", () => {
    const a = createRace({ ...base, seed: 1 })
      .run()
      .map((r) => r.driverId);
    const b = createRace({ ...base, seed: 2 })
      .run()
      .map((r) => r.driverId);
    expect(a).not.toEqual(b);
  });

  it("keeps the weather and failures independent of the player's choices", () => {
    const withChoices = createRace({
      ...base,
      seed: 9,
      weather: "auto",
      playerTeamId: "ferrari",
    });
    withChoices.command({ type: "pit", driverId: "leclerc", compound: "soft" });
    const without = createRace({
      ...base,
      seed: 9,
      weather: "auto",
      playerTeamId: "ferrari",
    });
    expect(withChoices.weather.timeline).toEqual(without.weather.timeline);
    expect(withChoices.cars.map((c) => c.failureLap)).toEqual(
      without.cars.map((c) => c.failureLap),
    );
  });

  it("pits a player car with the requested compound", () => {
    const race = createRace({
      ...base,
      playerTeamId: "mclaren",
      startingTyres: { norris: "medium", piastri: "medium" },
    });
    const norris = race.carByDriver("norris")!;
    runUntil(race, () => norris.lap >= 3);
    race.command({ type: "pit", driverId: "norris", compound: "hard" });
    runUntil(race, () => norris.pitStops.length > 0);
    expect(norris.pitStops[0]).toMatchObject({
      lap: 4,
      from: "medium",
      to: "hard",
    });
    expect(norris.status).toBe("pit");
    const lapBefore = norris.lapTimes[2];
    runUntil(race, () => norris.lap >= 5);
    // The lap containing the stop costs roughly the pit-lane loss plus the stationary time.
    const loss = norris.lapTimes[4] - lapBefore;
    expect(loss).toBeGreaterThan(monza.pitLaneLossSeconds);
    expect(loss).toBeLessThan(monza.pitLaneLossSeconds + 20);
  });

  it("makes no strategy calls for the player's cars", () => {
    const race = createRace({ ...base, laps: 10, playerTeamId: "mclaren" });
    race.run();
    for (const id of ["norris", "piastri"])
      expect(race.carByDriver(id)!.pitStops).toHaveLength(0);
  });

  it("disqualifies a dry full-distance finisher that used one compound", () => {
    const race = createRace({
      ...base,
      playerTeamId: "mclaren",
      startingTyres: { norris: "hard", piastri: "hard" },
    });
    race.command({ type: "pace", driverId: "norris", mode: "conserve" });
    race.command({ type: "pace", driverId: "piastri", mode: "conserve" });
    const results = race.run();
    const mclaren = results.filter((r) => r.teamId === "mclaren");
    expect(mclaren.some((r) => r.status === "dsq")).toBe(true);
    for (const r of mclaren) expect(["dsq", "dnf"]).toContain(r.status);
    for (const r of mclaren) expect(r.points).toBe(0);
  });

  it("drops the two-compound rule for short races", () => {
    const race = createRace({ ...base, laps: 10 });
    expect(race.requireTwoCompounds).toBe(false);
    const results = race.run();
    expect(results.some((r) => r.status === "dsq")).toBe(false);
  });

  it("starts a wet race on wet-weather tyres", () => {
    const race = createRace({ ...base, weather: "wet" });
    for (const car of race.cars)
      expect(["intermediate", "wet"]).toContain(car.tyre.compound);
  });

  it("swaps teammates on a team order", () => {
    // Put the player's cars at the front, the slower driver ahead.
    const grid = [
      "piastri",
      "norris",
      ...drivers
        .map((d) => d.id)
        .filter((id) => id !== "norris" && id !== "piastri"),
    ];
    const race = createRace({ ...base, grid, playerTeamId: "mclaren" });
    const norris = race.carByDriver("norris")!;
    const piastri = race.carByDriver("piastri")!;
    runUntil(race, () => race.leaderLap >= 3);
    expect(norris.position).toBe(piastri.position + 1);
    expect(norris.interval!).toBeLessThan(2.5);
    race.command({ type: "team-order", teamId: "mclaren", order: "swap" });
    const orderedAt = race.time;
    runUntil(race, () => norris.position < piastri.position);
    expect(norris.position).toBeLessThan(piastri.position);
    expect(race.time - orderedAt).toBeLessThan(40);
  });

  it("neutralises the race after incidents and freezes overtaking under it", () => {
    let deployments = 0;
    for (let seed = 0; seed < 20; seed++) {
      const race = createRace({ ...base, seed, track: getTrack("marina_bay") });
      while (!race.finished) {
        const before = race.trackStatus;
        const events = race.step();
        const after = race.trackStatus as string;
        if (before !== "green" && after !== "green") {
          expect(events.some((e) => e.type === "overtake")).toBe(false);
        }
      }
      deployments += race.safetyCar.deployments.length;
    }
    expect(deployments).toBeGreaterThan(10);
  });
});

describe("pit wall estimates", () => {
  const silverstone = getTrack("silverstone");

  it("predicts where a car rejoins after a stop", () => {
    let stops = 0;
    let close = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const race = createRace({ ...base, seed, track: silverstone });
      let predicted = race.cars.map((c) => race.pitRejoin(c));
      const pending = new Map<number, number>();
      while (!race.finished) {
        for (const e of race.step()) {
          if (e.type === "pit-entry" && predicted[e.car])
            pending.set(e.car, predicted[e.car]!.position);
          if (e.type === "pit-exit" && pending.has(e.car)) {
            stops++;
            const error = race.cars[e.car].position - pending.get(e.car)!;
            if (Math.abs(error) <= 2) close++;
            pending.delete(e.car);
          }
        }
        predicted = race.cars.map((c) => race.pitRejoin(c));
      }
    }
    expect(stops).toBeGreaterThan(50);
    expect(close / stops).toBeGreaterThan(0.8);
  });

  it("costs less track position under the Safety Car", () => {
    const race = createRace({ ...base, seed: 3, track: silverstone });
    runUntil(race, () => race.leaderLap >= 10);
    const car = race.cars[race.order[10]];
    const green = race.pitRejoin(car)!;
    expect(green.position).toBeGreaterThan(car.position);
    expect(green.lossSeconds).toBeGreaterThan(silverstone.pitLaneLossSeconds);
    for (const c of race.cars) if (c.status === "racing") c.speed *= 0.5;
    expect(race.pitRejoin(car)!.position).toBeLessThan(green.position);
  });

  it("gives a pass chance per lap that matches how often passes happen", () => {
    const likely = { predicted: 0, passed: 0, n: 0 };
    const unlikely = { predicted: 0, passed: 0, n: 0 };
    for (let seed = 1; seed <= 4; seed++) {
      const race = createRace({ ...base, seed, track: silverstone });
      let lap = -1;
      let open: { car: number; ahead: number; chance: number }[] = [];
      while (!race.finished) {
        race.step();
        if (race.leaderLap === lap) continue;
        lap = race.leaderLap;
        for (const b of open) {
          const group = b.chance >= 0.1 ? likely : unlikely;
          group.n++;
          group.predicted += b.chance;
          if (race.cars[b.car].position < race.cars[b.ahead].position)
            group.passed++;
        }
        open = [];
        if (lap < 2) continue;
        for (const car of race.cars) {
          const battle = race.battle(car);
          if (!battle || battle.gap > 1) continue;
          expect(battle.paceDelta).toBeCloseTo(
            race.expectedLap(race.cars[battle.ahead]) - race.expectedLap(car),
          );
          open.push({ car: car.index, ...battle, chance: battle.passChance });
        }
      }
    }
    expect(likely.n).toBeGreaterThan(100);
    const observed = likely.passed / likely.n;
    expect(observed).toBeGreaterThan(unlikely.passed / unlikely.n);
    expect(Math.abs(observed - likely.predicted / likely.n)).toBeLessThan(0.1);
  });

  it("only reports battles under green flags", () => {
    const race = createRace({ ...base, seed: 3, track: silverstone });
    runUntil(race, () => race.cars.some((c) => race.battle(c)));
    expect(race.trackStatus).toBe("green");
    expect(race.battle(race.cars[race.order[0]])).toBeNull();
  });
});
