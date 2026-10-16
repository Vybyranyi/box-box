import { drivers, getTrack, teams, tracks } from "@/data";
import { createQualifying, createRace } from "@/engine";
import { describe, expect, it } from "vitest";
import { alertFor } from "./alerts";
import { boxCalls, carInsights, pitWindow } from "./insights";
import { MomentLog } from "./moments";
import { qualiFeed } from "./quali-text";
import { RadioRequests } from "./radio-requests";
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
      const said = new Set<string>();
      const requests = new RadioRequests();
      const log = new MomentLog("mclaren");
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
        if (race.tick % 20 === 0) {
          for (const car of race.cars.filter((c) => c.isPlayer))
            for (const kind of ["attack", "defend"] as const)
              if (race.canBoost(car, kind))
                race.command({ type: "boost", driverId: car.driverId, kind });
          produced.push(...boxCalls(race, "mclaren", said));
          for (const r of requests.update(race, "mclaren")) {
            produced.push(r.message, r.yesReply, r.noReply);
            requests.answer(r.id);
          }
          log.observe(race);
          for (const car of race.cars) {
            for (const insight of carInsights(race, car))
              produced.push(
                insight.message,
                ...(insight.tip ? [insight.tip] : []),
              );
            const window = pitWindow(race, car);
            if (window) produced.push(window.message);
          }
        }
      }
      produced.push(...log.finish(race).map((m) => m.message));
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
    expect(
      [...keys].filter((k) => k.startsWith("insight.")).length,
    ).toBeGreaterThan(8);
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

describe("request and moment texts", () => {
  it("renders every one in both languages", () => {
    const values = {
      car: "NOR",
      rival: "LEC",
      chance: 35,
      gain: "1.2",
      wear: 88,
      places: 3,
      boosted: "yes",
    };
    const leaves = (obj: object, prefix: string): string[] =>
      Object.entries(obj).flatMap(([k, v]) =>
        typeof v === "object" ? leaves(v, `${prefix}${k}.`) : [`${prefix}${k}`],
      );
    const keys = [
      ...leaves(MESSAGES.en.moments, "moments."),
      ...leaves(MESSAGES.en.radioRequest, "radioRequest."),
    ];
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys)
      for (const locale of ["en", "uk"] as const) {
        const text = tr({ key, values }, locale);
        expect(text, `${locale}: ${key}`).not.toMatch(/[{}]/);
      }
    expect(tr({ key: "moments.goodStart", values }, "uk")).toContain(
      "3 позиції",
    );
  });
});

describe("qualifying texts", () => {
  it("translates every feed line a session produces", () => {
    const session = createQualifying({
      seed: 5,
      track: getTrack("silverstone"),
      teams,
      drivers,
      weather: "dry",
      playerTeamId: "mclaren",
    });
    session.command({ type: "auto" });
    const keys = new Set<string>();
    while (session.state !== "finished") {
      if (session.state === "break") session.nextPhase();
      for (const event of session.step()) {
        const item = qualiFeed(session, event, "mclaren");
        if (!item) continue;
        keys.add(item.message.key);
        for (const locale of ["en", "uk"] as const)
          expect(tr(item.message, locale), item.message.key).not.toMatch(
            /[{}]/,
          );
      }
    }
    expect(keys.size).toBeGreaterThan(4);
    expect(keys).toContain("quali.feed.pole");
  });
});
