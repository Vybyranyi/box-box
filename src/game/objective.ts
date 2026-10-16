import type { Team, Track } from "@/data/types";
import { carFactor, type ClassifiedResult, type Race } from "@/engine";
import { msg, type Msg } from "./messages";

export type Objective = {
  /** Team's car rank for this track, 1 = fastest. */
  rank: number;
  text: Msg;
  /** Expected finishing positions of the two cars. */
  expected: [number, number];
  met: (results: ClassifiedResult[]) => boolean;
};

export type Grade = "S" | "A" | "B" | "C" | "D";

export type RaceReport = {
  objective: Objective;
  met: boolean;
  score: number;
  grade: Grade;
  points: number;
  breakdown: { label: Msg; value: number }[];
  results: ClassifiedResult[];
};

/** Teams ordered by car pace at this track. */
export function teamRanking(teams: Team[], track: Track): Team[] {
  return [...teams].sort((a, b) => carFactor(a, track) - carFactor(b, track));
}

const isClassified = (r: ClassifiedResult) =>
  r.status === "finished" || r.status === "lapped";
const best = (rs: ClassifiedResult[]) =>
  Math.min(...rs.filter(isClassified).map((r) => r.position), 99);

/** What the team boss expects this weekend, from how fast the car is here. */
export function teamObjective(
  teams: Team[],
  track: Track,
  teamId: string,
): Objective {
  const rank = teamRanking(teams, track).findIndex((t) => t.id === teamId) + 1;
  const expected: [number, number] = [rank * 2 - 1, rank * 2];
  const top = (n: number, key: string) => ({
    text: msg(`objective.${key}`),
    met: (rs: ClassifiedResult[]) => best(rs) <= n,
  });

  let goal: { text: Msg; met: (rs: ClassifiedResult[]) => boolean };
  if (rank === 1) goal = top(1, "win");
  else if (rank <= 3) goal = top(3, "podium");
  else if (rank === 4) goal = top(6, "topSix");
  else if (rank <= 6)
    goal = {
      text: msg("objective.bothPoints"),
      met: (rs) =>
        rs.filter((r) => isClassified(r) && r.position <= 10).length === 2,
    };
  else if (rank <= 8) goal = top(10, "points");
  else if (rank === 9) goal = top(12, "topTwelve");
  else
    goal = {
      text: msg("objective.bothHome"),
      met: (rs) => rs.every(isClassified),
    };

  return { rank, expected, ...goal };
}

/** How the race went for the player's team: objective, score out of ~100, grade S–D. */
export function gradeRace(race: Race, teamId: string): RaceReport {
  const all = race.classification();
  const results = all.filter((r) => r.teamId === teamId);
  const objective = teamObjective(race.config.teams, race.track, teamId);
  const met = objective.met(results);
  const points = results.reduce((s, r) => s + r.points, 0);

  // Positions vs expectation; a mechanical failure isn't the pit wall's fault.
  const finishPositions = results.map((r, i) => {
    if (r.status === "dsq") return 22;
    if (r.status === "dnf") {
      const car = race.carByDriver(r.driverId)!;
      return car.retiredReason === "mechanical" ? objective.expected[i] : 22;
    }
    return r.position;
  });
  const expectedAvg = (objective.expected[0] + objective.expected[1]) / 2;
  const actualAvg =
    finishPositions.reduce((s, p) => s + p, 0) / finishPositions.length;

  const breakdown: { label: Msg; value: number }[] = [
    {
      label: msg(
        met
          ? "results.breakdown.objectiveMet"
          : "results.breakdown.objectiveMissed",
      ),
      value: met ? 60 : 25,
    },
    {
      label: msg("results.breakdown.vsExpectation"),
      value: Math.round(
        Math.max(-30, Math.min(30, (expectedAvg - actualAvg) * 6)),
      ),
    },
  ];
  if (results.some((r) => r.position === 1 && r.status === "finished"))
    breakdown.push({ label: msg("results.breakdown.win"), value: 10 });
  else if (results.some((r) => r.position <= 3 && isClassified(r)))
    breakdown.push({ label: msg("results.breakdown.podium"), value: 5 });
  if (race.fastestLap && race.cars[race.fastestLap.car].teamId === teamId)
    breakdown.push({ label: msg("results.breakdown.fastestLap"), value: 5 });
  if (results.every((r) => isClassified(r) && r.position <= 10))
    breakdown.push({ label: msg("results.breakdown.doublePoints"), value: 5 });
  if (results.some((r) => r.status === "dsq"))
    breakdown.push({ label: msg("results.breakdown.dsq"), value: -40 });

  const score = Math.max(
    0,
    breakdown.reduce((s, b) => s + b.value, 0),
  );
  const grade: Grade =
    score >= 95
      ? "S"
      : score >= 80
        ? "A"
        : score >= 65
          ? "B"
          : score >= 45
            ? "C"
            : "D";
  return { objective, met, score, grade, points, breakdown, results };
}
