import type { PowerUnit } from "../../src/data/types";

/** Per-team facts the APIs don't provide. Keyed by Jolpica constructorId. */
export const curatedTeams: Record<
  string,
  {
    shortName: string;
    mediaSlug: string;
    powerUnit: PowerUnit;
    /** Tyre wear multiplier: < 1 kinder on tyres, > 1 harder on them. */
    tyreWear: number;
  }
> = {
  mercedes: {
    shortName: "Mercedes",
    mediaSlug: "mercedes",
    powerUnit: "Mercedes",
    tyreWear: 0.97,
  },
  ferrari: {
    shortName: "Ferrari",
    mediaSlug: "ferrari",
    powerUnit: "Ferrari",
    tyreWear: 1.0,
  },
  mclaren: {
    shortName: "McLaren",
    mediaSlug: "mclaren",
    powerUnit: "Mercedes",
    tyreWear: 0.94,
  },
  red_bull: {
    shortName: "Red Bull",
    mediaSlug: "redbullracing",
    powerUnit: "Red Bull Ford",
    tyreWear: 1.0,
  },
  rb: {
    shortName: "Racing Bulls",
    mediaSlug: "racingbulls",
    powerUnit: "Red Bull Ford",
    tyreWear: 1.02,
  },
  alpine: {
    shortName: "Alpine",
    mediaSlug: "alpine",
    powerUnit: "Mercedes",
    tyreWear: 1.02,
  },
  haas: {
    shortName: "Haas",
    mediaSlug: "haasf1team",
    powerUnit: "Ferrari",
    tyreWear: 0.98,
  },
  audi: {
    shortName: "Audi",
    mediaSlug: "audi",
    powerUnit: "Audi",
    tyreWear: 1.03,
  },
  williams: {
    shortName: "Williams",
    mediaSlug: "williams",
    powerUnit: "Mercedes",
    tyreWear: 1.04,
  },
  aston_martin: {
    shortName: "Aston Martin",
    mediaSlug: "astonmartin",
    powerUnit: "Honda",
    tyreWear: 1.03,
  },
  cadillac: {
    shortName: "Cadillac",
    mediaSlug: "cadillac",
    powerUnit: "Ferrari",
    tyreWear: 1.05,
  },
};
