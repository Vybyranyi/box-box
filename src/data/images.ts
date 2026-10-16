import type { Driver, Team } from "./types";

/**
 * Official images are hotlinked from the formula1.com media CDN, never stored in the repo.
 * Render them with a plain <img> and fall back to initials / team name on error.
 */
const CDN = "https://media.formula1.com/image/upload";
const VERSION = "v1740000001";
const SEASON = 2026;

function cdnUrl(path: string, width: number) {
  return `${CDN}/c_lfill,w_${width}/q_auto/${VERSION}/common/f1/${SEASON}/${path}`;
}

/** Driver portrait in team kit, transparent background. */
export function getDriverImage(
  driver: Driver,
  team: Team,
  width = 400,
): string {
  const slug = team.mediaSlug;
  return cdnUrl(
    `${slug}/${driver.mediaRef}/${SEASON}${slug}${driver.mediaRef}right.webp`,
    width,
  );
}

export type TeamImageKind = "logo" | "car";

/** White team logo or side-on car render, transparent background. */
export function getTeamImage(
  team: Team,
  kind: TeamImageKind,
  width = 400,
): string {
  const file = kind === "logo" ? "logowhite" : "carright";
  return cdnUrl(
    `${team.mediaSlug}/${SEASON}${team.mediaSlug}${file}.webp`,
    width,
  );
}

export function getDriverInitials(driver: Driver): string {
  return `${driver.firstName[0]}${driver.lastName[0]}`.toUpperCase();
}
