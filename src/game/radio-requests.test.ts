import { drivers, getTrack, teams } from "@/data";
import { createRace } from "@/engine";
import { describe, expect, it } from "vitest";
import { RadioRequests, type RadioRequest } from "./radio-requests";

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

describe("driver radio requests", () => {
  it("asks to box on worn tyres, and Yes calls the car in", () => {
    const race = raceAt(2);
    const requests = new RadioRequests();
    let asked: RadioRequest | null = null;
    while (!race.finished && !asked) {
      race.step();
      asked =
        requests.update(race, "alpine").find((r) => r.kind === "box") ?? null;
    }
    expect(asked).not.toBeNull();
    const car = race.carByDriver(asked!.driverId)!;
    expect(car.tyre.wear).toBeGreaterThanOrEqual(76);
    const answered = requests.answer(asked!.id)!;
    for (const command of answered.yes) race.command(command);
    race.step();
    expect(car.pitRequest).not.toBeNull();
    expect(requests.active.some((r) => r.id === asked!.id)).toBe(false);
  });

  it("asks at most once per car at a time, and not again for the same thing soon", () => {
    const race = raceAt(3);
    const requests = new RadioRequests();
    const asked: RadioRequest[] = [];
    while (!race.finished) {
      race.step();
      asked.push(...requests.update(race, "alpine"));
      for (const driverId of new Set(requests.active.map((r) => r.driverId)))
        expect(
          requests.active.filter((r) => r.driverId === driverId),
        ).toHaveLength(1);
    }
    expect(asked.length).toBeGreaterThan(0);
    for (const a of asked)
      for (const b of asked) {
        if (a === b || a.driverId !== b.driverId || a.kind !== b.kind) continue;
        expect(
          Math.abs(Number(a.id.split(":")[2]) - Number(b.id.split(":")[2])),
        ).toBeGreaterThanOrEqual(8);
      }
  });

  it("lets requests lapse when nobody answers", () => {
    const race = raceAt(2);
    const requests = new RadioRequests();
    let first: RadioRequest | undefined;
    while (!race.finished && !first) {
      race.step();
      first = requests.update(race, "alpine")[0];
    }
    while (!race.finished && race.time <= first!.expiresAt) race.step();
    requests.update(race, "alpine");
    expect(requests.active.some((r) => r.id === first!.id)).toBe(false);
    expect(requests.answer(first!.id)).toBeNull();
  });

  it("asks to be let past a slower teammate", () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 10 && !kinds.has("through"); seed++) {
      const race = raceAt(seed);
      const requests = new RadioRequests();
      while (!race.finished) {
        race.step();
        for (const r of requests.update(race, "alpine")) {
          kinds.add(r.kind);
          if (r.kind === "through")
            expect(r.yes).toEqual([
              { type: "team-order", teamId: "alpine", order: "swap" },
            ]);
          requests.answer(r.id);
        }
      }
    }
    expect(kinds).toContain("through");
    expect(kinds).toContain("push");
  });
});
