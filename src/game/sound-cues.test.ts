import { drivers, getTrack, teams } from "@/data";
import { createRace } from "@/engine";
import { describe, expect, it } from "vitest";
import { cuesFor, type Cue } from "./sound-cues";

describe("sound cues", () => {
  it("plays only what matters to the player", () => {
    const race = createRace({
      seed: 4,
      track: getTrack("silverstone"),
      teams,
      drivers,
      weather: "dry",
      laps: 20,
      playerTeamId: "alpine",
    });
    const heard = new Set<Cue>();
    let foreignPasses = 0;
    while (!race.finished) {
      if (race.leaderLap === 8)
        for (const car of race.cars.filter((c) => c.isPlayer && !c.pitRequest))
          if (car.pitStops.length === 0)
            race.command({
              type: "pit",
              driverId: car.driverId,
              compound: "hard",
            });
      const events = race.step();
      const cues = cuesFor(race, events, "alpine");
      for (const cue of cues) heard.add(cue);
      expect(new Set(cues).size).toBe(cues.length);
      for (const e of events) {
        if (e.type === "overtake") {
          const involved = [e.car, e.on].some(
            (i) => race.cars[i].teamId === "alpine",
          );
          if (!involved) {
            foreignPasses++;
            expect(
              cuesFor(race, [e], "alpine").filter((c) =>
                c.startsWith("overtake"),
              ),
            ).toEqual([]);
          }
        }
        if (e.type === "pit-entry")
          expect(cuesFor(race, [e], "alpine").includes("pitStop")).toBe(
            race.cars[e.car].teamId === "alpine",
          );
      }
    }
    expect(foreignPasses).toBeGreaterThan(0);
    expect(heard).toContain("chequered");
    expect(heard).toContain("pitStop");
  });

  it("is silent about other teams for a spectator", () => {
    const race = createRace({
      seed: 4,
      track: getTrack("silverstone"),
      teams,
      drivers,
      weather: "dry",
      laps: 10,
    });
    const heard = new Set<Cue>();
    while (!race.finished)
      for (const cue of cuesFor(race, race.step(), null)) heard.add(cue);
    expect(heard.has("pitStop")).toBe(false);
    expect(heard.has("overtakeGain")).toBe(false);
    expect(heard).toContain("chequered");
  });
});
