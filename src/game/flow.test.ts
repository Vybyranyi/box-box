import { tr } from "./test-i18n";
import { drivers, getTrack, teams, tracks } from "@/data";
import { createRace } from "@/engine";
import { describe, expect, it } from "vitest";
import { gradeRace, teamObjective, teamRanking } from "./objective";
import { parseRaceParams, withSeed } from "./parse-params";
import { DISTANCES, lapsFor, raceQuery } from "./race-options";

describe("team objectives", () => {
  it("expects more from faster cars", () => {
    const monza = getTrack("monza");
    const ranking = teamRanking(teams, monza);
    expect(tr(teamObjective(teams, monza, ranking[0].id).text)).toBe(
      "Win the race",
    );
    expect(tr(teamObjective(teams, monza, ranking[1].id).text)).toBe(
      "Finish on the podium",
    );
    expect(tr(teamObjective(teams, monza, ranking[10].id).text)).toBe(
      "Bring both cars home",
    );
    for (const [i, t] of ranking.entries())
      expect(teamObjective(teams, monza, t.id).expected).toEqual([
        i * 2 + 1,
        i * 2 + 2,
      ]);
  });

  it("covers every team on every track", () => {
    for (const track of tracks) {
      const objectives = teams.map((t) => teamObjective(teams, track, t.id));
      expect(new Set(objectives.map((o) => o.rank)).size).toBe(teams.length);
    }
  });
});

describe("gradeRace", () => {
  it("grades a full race with a score and a breakdown", () => {
    const race = createRace({
      seed: 8,
      track: getTrack("monza"),
      teams,
      drivers,
      weather: "dry",
      laps: 12,
      playerTeamId: "mclaren",
    });
    race.run();
    const report = gradeRace(race, "mclaren");
    expect(["S", "A", "B", "C", "D"]).toContain(report.grade);
    expect(report.results).toHaveLength(2);
    expect(report.score).toBe(
      Math.max(
        0,
        report.breakdown.reduce((s, b) => s + b.value, 0),
      ),
    );
    expect(report.points).toBe(
      report.results.reduce((s, r) => s + r.points, 0),
    );
  });

  it("credits a met objective well above a missed one", () => {
    const grades = Array.from({ length: 10 }, (_, seed) => {
      const race = createRace({
        seed,
        track: getTrack("monza"),
        teams,
        drivers,
        weather: "dry",
        laps: 10,
        playerTeamId: "cadillac",
      });
      race.run();
      return gradeRace(race, "cadillac");
    });
    for (const g of grades) {
      if (g.met) expect(g.score).toBeGreaterThanOrEqual(30);
      else expect(g.breakdown[0].value).toBe(25);
    }
  });
});

describe("race options and URLs", () => {
  it("turns distances into lap counts", () => {
    const monza = getTrack("monza");
    expect(lapsFor(monza, "sprint")).toBe(10);
    expect(lapsFor(monza, "full")).toBe(monza.laps);
    expect(lapsFor(monza, "half")).toBe(Math.round(monza.laps / 2));
    for (const track of tracks)
      for (const d of DISTANCES)
        expect(lapsFor(track, d.id)).toBeGreaterThanOrEqual(5);
  });

  it("round-trips race parameters through the URL", () => {
    const query = raceQuery({
      trackId: "spa",
      teamId: "ferrari",
      laps: 11,
      weather: "wet",
      seed: 42,
    });
    const parsed = parseRaceParams(
      Object.fromEntries(new URLSearchParams(query)),
    );
    expect(parsed).toEqual({
      trackId: "spa",
      teamId: "ferrari",
      laps: 11,
      weather: "wet",
      seed: 42,
    });
    expect(new URLSearchParams(withSeed(parsed, 7)).get("seed")).toBe("7");
  });

  it("falls back to safe defaults for bad input", () => {
    const parsed = parseRaceParams({
      track: "nowhere",
      team: "x",
      laps: "-3",
      weather: "snow",
      seed: "abc",
    });
    expect(parsed).toEqual({
      trackId: "monza",
      teamId: null,
      laps: undefined,
      weather: "auto",
      seed: null,
    });
    expect(parseRaceParams({ track: "monaco", laps: "999" }).laps).toBe(
      getTrack("monaco").laps,
    );
  });
});
