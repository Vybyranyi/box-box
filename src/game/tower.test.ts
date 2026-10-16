import { drivers, getTrack, teams } from "@/data";
import { createRace } from "@/engine";
import { describe, expect, it } from "vitest";
import { describeEvent } from "./event-text";
import { buildTower } from "./tower";

const race = () =>
  createRace({
    seed: 11,
    track: getTrack("monza"),
    teams,
    drivers,
    weather: "dry",
  });

describe("buildTower", () => {
  it("lists every car in classification order", () => {
    const r = race();
    for (let i = 0; i < 600; i++) r.step();
    const rows = buildTower(r);
    expect(rows).toHaveLength(22);
    expect(rows.map((row) => row.position)).toEqual(
      Array.from({ length: 22 }, (_, i) => i + 1),
    );
    expect(rows[0].gap).toBe("LEADER");
    expect(rows[1].gap).toMatch(/^\+\d+\.\d{3}$/);
  });

  it("shows pit stops, retirements and the winner", () => {
    const r = race();
    r.run();
    const rows = buildTower(r);
    expect(rows[0].gap).toBe("WINNER");
    for (const row of rows.filter((x) => x.state === "retired"))
      expect(row.gap).toBe("DNF");
    expect(rows.some((row) => row.stops > 0)).toBe(true);
  });
});

describe("describeEvent", () => {
  it("writes readable lines with the lap being raced", () => {
    const r = race();
    r.run();
    const lines = r.events
      .map((e) => describeEvent(r, e))
      .filter((x) => x !== null);
    expect(lines[0]).toMatchObject({
      lap: 1,
      text: "Lights out and away we go!",
    });
    expect(lines.some((l) => l.text.includes("pits for"))).toBe(true);
    expect(lines.every((l) => l.lap >= 1 && l.lap <= r.laps)).toBe(true);
    expect(new Set(lines.map((l) => l.id)).size).toBe(lines.length);
  });
});
