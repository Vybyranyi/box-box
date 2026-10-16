import { drivers, getTrack, teams, tracks } from "@/data";
import { createRace } from "@/engine";
import { describe, expect, it } from "vitest";
import { alertFor } from "./alerts";
import { describeEvent } from "./event-text";
import type { Msg } from "./messages";
import { gradeRace, teamObjective } from "./objective";
import { planSummary, suggestedStart } from "./pit-wall";
import { radioFor } from "./radio";
import { MESSAGES, tr } from "./test-i18n";

/** All leaf key paths of a messages object, e.g. "race.status.green". */
function keyPaths(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? keyPaths(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe("translations", () => {
  it("has exactly the same keys in every language", () => {
    const en = keyPaths(MESSAGES.en).sort();
    const uk = keyPaths(MESSAGES.uk).sort();
    expect(uk.filter((k) => !en.includes(k))).toEqual([]);
    expect(en.filter((k) => !uk.includes(k))).toEqual([]);
  });

  it("names every circuit in every language", () => {
    for (const track of tracks) {
      expect(tr({ key: `tracks.${track.id}` }, "en")).not.toContain("tracks.");
      expect(tr({ key: `tracks.${track.id}` }, "uk")).not.toContain("tracks.");
    }
  });

  it("translates every message the game produces, in both languages", () => {
    const produced: Msg[] = [];
    // Mixed weather on rain-prone, incident-prone tracks covers radio, alerts and crossovers.
    for (const [seed, trackId] of [
      [52, "marina_bay"],
      [11, "spa"],
      [3, "interlagos"],
      [7, "monza"],
    ] as const) {
      const race = createRace({
        seed,
        track: getTrack(trackId),
        teams,
        drivers,
        weather: "mixed",
        laps: 25,
        playerTeamId: "mclaren",
      });
      for (const car of race.cars.filter((c) => c.isPlayer))
        produced.push(suggestedStart(race, car).summary);
      while (!race.finished) {
        for (const event of race.step()) {
          const control = describeEvent(race, event);
          const radio = radioFor(race, event, "mclaren");
          const alert = alertFor(race, event, "mclaren");
          if (control) produced.push(control.message);
          if (radio) produced.push(radio.message);
          if (alert) produced.push(alert.title, alert.body);
        }
        if (race.tick % 200 === 0)
          for (const car of race.cars.filter((c) => c.isPlayer))
            produced.push(planSummary(race, car));
      }
      const report = gradeRace(race, "mclaren");
      produced.push(
        report.objective.text,
        ...report.breakdown.map((b) => b.label),
      );
    }
    for (const team of teams)
      produced.push(teamObjective(teams, getTrack("monza"), team.id).text);

    const keys = new Set(produced.map((m) => m.key));
    expect(keys.size).toBeGreaterThan(30);
    for (const message of produced) {
      for (const locale of ["en", "uk"] as const) {
        const text = tr(message, locale);
        expect(text.length, `${locale}: ${message.key}`).toBeGreaterThan(0);
        expect(text, `${locale}: ${message.key}`).not.toMatch(/[{}]/);
      }
    }
  });

  it("uses Ukrainian plural forms", () => {
    expect(tr({ key: "setup.lapsCount", values: { laps: 1 } }, "uk")).toBe(
      "1 коло",
    );
    expect(tr({ key: "setup.lapsCount", values: { laps: 3 } }, "uk")).toBe(
      "3 кола",
    );
    expect(tr({ key: "setup.lapsCount", values: { laps: 14 } }, "uk")).toBe(
      "14 кіл",
    );
    expect(tr({ key: "setup.lapsCount", values: { laps: 22 } }, "uk")).toBe(
      "22 кола",
    );
  });

  it("translates nested tyre names inside messages", () => {
    const message: Msg = {
      key: "control.pitEntry",
      values: { car: "NOR", compound: { key: "tyresPlural.hard" } },
    };
    expect(tr(message, "en")).toBe("NOR pits for hards");
    expect(tr(message, "uk")).toBe("NOR заїжджає в бокси, шини: жорсткі");
  });
});
