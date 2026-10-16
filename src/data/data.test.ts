import { describe, expect, it } from "vitest";
import { calendar, drivers, getTeamDrivers, getTrack, teams, tracks } from ".";
import { getDriverImage, getTeamImage } from "./images";

describe("teams and drivers", () => {
  it("has the 11-team, 22-driver 2026 grid", () => {
    expect(teams).toHaveLength(11);
    expect(drivers).toHaveLength(22);
    for (const team of teams) expect(getTeamDrivers(team.id)).toHaveLength(2);
  });

  it("has unique driver codes and numbers", () => {
    expect(new Set(drivers.map((d) => d.code)).size).toBe(drivers.length);
    expect(new Set(drivers.map((d) => d.number)).size).toBe(drivers.length);
  });

  it("keeps ratings within 0..100", () => {
    for (const d of drivers) {
      for (const value of Object.values(d.ratings)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });

  it("has sane car parameters", () => {
    expect(Math.min(...teams.map((t) => t.car.paceDeficitPct))).toBe(0);
    for (const t of teams) {
      expect(t.color).toMatch(/^#[0-9A-F]{6}$/);
      expect(t.car.paceDeficitPct).toBeLessThan(6);
      expect(t.car.reliability).toBeGreaterThan(0.7);
      expect(t.car.reliability).toBeLessThanOrEqual(1);
      expect(t.car.tyreWear).toBeGreaterThan(0.8);
      expect(t.car.tyreWear).toBeLessThan(1.2);
    }
  });

  it("builds formula1.com CDN image URLs", () => {
    const driver = drivers.find((d) => d.code === "VER")!;
    const team = teams.find((t) => t.id === driver.teamId)!;
    expect(driver.mediaRef).toMatch(/^[a-z]{6}\d{2}$/);
    expect(getDriverImage(driver, team)).toContain(
      `/${team.mediaSlug}/${driver.mediaRef}/`,
    );
    expect(getTeamImage(team, "logo")).toContain("logowhite.webp");
  });
});

describe("tracks and calendar", () => {
  it("has a track for every calendar round", () => {
    expect(calendar.length).toBeGreaterThanOrEqual(20);
    for (const round of calendar)
      expect(() => getTrack(round.trackId)).not.toThrow();
  });

  it("has plausible lap counts and times", () => {
    for (const t of tracks) {
      const raceKm = (t.laps * t.lengthMeters) / 1000;
      expect(raceKm, t.id).toBeGreaterThan(t.id === "monaco" ? 255 : 300);
      expect(raceKm, t.id).toBeLessThan(320);
      expect(t.poleTimeSeconds, t.id).toBeGreaterThan(60);
      expect(t.poleTimeSeconds, t.id).toBeLessThan(120);
      expect(t.fastestRaceLapSeconds, t.id).toBeGreaterThan(t.poleTimeSeconds);
      expect(t.fastestRaceLapSeconds / t.poleTimeSeconds, t.id).toBeLessThan(
        1.09,
      );
      expect(t.pitLaneLossSeconds, t.id).toBeGreaterThan(14);
      expect(t.pitLaneLossSeconds, t.id).toBeLessThan(32);
    }
  });

  it("has a closed, evenly spaced path matching the track length", () => {
    for (const t of tracks) {
      const steps = t.path.map((p, i) => {
        const q = t.path[(i + 1) % t.path.length];
        return Math.hypot(q[0] - p[0], q[1] - p[1]);
      });
      const total = steps.reduce((s, x) => s + x, 0);
      const expectedStep = t.lengthMeters / t.path.length;
      expect(total / t.lengthMeters, t.id).toBeCloseTo(1, 2);
      expect(Math.max(...steps), t.id).toBeLessThan(expectedStep * 1.2);
      expect(Math.min(...steps), t.id).toBeGreaterThan(expectedStep * 0.8);
    }
  });
});
