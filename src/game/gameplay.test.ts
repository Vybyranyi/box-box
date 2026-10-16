import { tr } from "./test-i18n";
import { drivers, getTrack, teams } from "@/data";
import { createRace, type Race } from "@/engine";
import { describe, expect, it } from "vitest";
import { alertFor } from "./alerts";
import { describeEvent, ENGINEER } from "./event-text";
import {
  estimatedWear,
  lapsLeftOnTyre,
  needsSecondCompound,
  planSummary,
  recommendedCompound,
  suggestedStart,
} from "./pit-wall";
import { radioFor } from "./radio";

const make = (
  seed = 52,
  trackId = "marina_bay",
  weather: "dry" | "mixed" | "wet" = "mixed",
) =>
  createRace({
    seed,
    track: getTrack(trackId),
    teams,
    drivers,
    weather,
    playerTeamId: "mclaren",
  });

const norris = (race: Race) => race.carByDriver("norris")!;

describe("pit wall advice", () => {
  it("estimates wear close to the truth, stable within a stint", () => {
    const race = make(1, "monza", "dry");
    const car = norris(race);
    while (car.lap < 8) race.step();
    const estimate = estimatedWear(race, car);
    expect(Math.abs(estimate - car.tyre.wear)).toBeLessThanOrEqual(
      car.tyre.wear * 0.08 + 1e-9,
    );
    expect(estimatedWear(race, car)).toBe(estimate);
  });

  it("forecasts laps left at green-flag pace", () => {
    const race = make(1, "monza", "dry");
    const car = norris(race);
    while (car.lap < 3) race.step();
    const left = lapsLeftOnTyre(race, car)!;
    expect(left).toBeGreaterThan(5);
    expect(left).toBeLessThan(40);
    race.safetyCar.status = "sc";
    expect(lapsLeftOnTyre(race, car)).toBe(left);
  });

  it("recommends the tyre for the conditions and the plan", () => {
    const dry = make(1, "monza", "dry");
    const car = norris(dry);
    expect(["medium", "hard", "soft"]).toContain(recommendedCompound(dry, car));
    expect(needsSecondCompound(dry, car)).toBe(true);
    expect(tr(planSummary(dry, car))).toMatch(/^Plan: box ~L\d+ for \w+/);
    expect(tr(suggestedStart(dry, car).summary)).toMatch(
      /^\d-stop: \w+ to L\d+, then \w+/,
    );

    const wet = make(1, "monza", "wet");
    expect(["intermediate", "wet"]).toContain(
      recommendedCompound(wet, norris(wet)),
    );
    expect(tr(suggestedStart(wet, norris(wet)).summary)).toMatch(/^Wet start/);
  });
});

describe("alerts, radio and feed over a full race", () => {
  // Collected live, step by step, the way the race view does it.
  const race = make();
  const alerts: NonNullable<ReturnType<typeof alertFor>>[] = [];
  const radio: NonNullable<ReturnType<typeof radioFor>>[] = [];
  let spectatorAlerts = 0;
  let spectatorRadio = 0;
  while (!race.finished) {
    for (const e of race.step()) {
      const alert = alertFor(race, e, "mclaren");
      if (alert) alerts.push(alert);
      const message = radioFor(race, e, "mclaren");
      if (message) radio.push(message);
      if (alertFor(race, e, null)) spectatorAlerts++;
      if (radioFor(race, e, null)) spectatorRadio++;
    }
  }

  it("raises alerts only for decisions the player can make", () => {
    const kinds = new Set(alerts.map((a) => a.kind));
    expect(kinds.has("sc") || kinds.has("vsc") || kinds.has("rain")).toBe(true);
    for (const a of alerts) {
      for (const index of a.cars)
        expect(race.cars[index].teamId).toBe("mclaren");
    }
    expect(spectatorAlerts).toBe(0);
  });

  it("talks on the radio for the player's team only", () => {
    expect(radio.length).toBeGreaterThan(3);
    for (const item of radio) {
      expect(item.kind).toBe("radio");
      expect(
        item.from === ENGINEER || ["NOR", "PIA"].includes(item.from!),
      ).toBe(true);
    }
    expect(spectatorRadio).toBe(0);
  });

  it("formats fastest laps as lap times, not race time", () => {
    for (const e of race.events) {
      if (e.type !== "fastest-lap") continue;
      expect(e.lapTime).toBeLessThan(200);
      const line = describeEvent(race, e);
      if (line) expect(tr(line.message)).toMatch(/\d:\d{2}\.\d{3}$/);
    }
  });

  it("gives every feed item a unique id", () => {
    const ids = race.events.flatMap((e) =>
      [describeEvent(race, e), radioFor(race, e, "mclaren")]
        .filter((x) => x !== null)
        .map((x) => x!.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
