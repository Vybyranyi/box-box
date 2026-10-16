import type { Team, Track } from "@/data/types";
import { carFactor, type ClassifiedResult, type Race } from "@/engine";

export type Objective = {
  /** Team's car rank for this track, 1 = fastest. */
  rank: number;
  text: string;
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
  breakdown: { label: string; value: number }[];
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
  const top = (n: number, text: string) => ({
    text,
    met: (rs: ClassifiedResult[]) => best(rs) <= n,
  });

  let goal: { text: string; met: (rs: ClassifiedResult[]) => boolean };
  if (rank === 1) goal = top(1, "Win the race");
  else if (rank <= 3) goal = top(3, "Finish on the podium");
  else if (rank === 4) goal = top(6, "Finish in the top six");
  else if (rank <= 6)
    goal = {
      text: "Get both cars into the points",
      met: (rs) =>
        rs.filter((r) => isClassified(r) && r.position <= 10).length === 2,
    };
  else if (rank <= 8) goal = top(10, "Score points");
  else if (rank === 9) goal = top(12, "Finish in the top twelve");
  else
    goal = {
      text: "Bring both cars home",
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

  const breakdown: { label: string; value: number }[] = [
    {
      label: met ? "Objective achieved" : "Objective missed",
      value: met ? 60 : 25,
    },
    {
      label: "Result vs expectation",
      value: Math.round(
        Math.max(-30, Math.min(30, (expectedAvg - actualAvg) * 6)),
      ),
    },
  ];
  if (results.some((r) => r.position === 1 && r.status === "finished"))
    breakdown.push({ label: "Race win", value: 10 });
  else if (results.some((r) => r.position <= 3 && isClassified(r)))
    breakdown.push({ label: "Podium", value: 5 });
  if (race.fastestLap && race.cars[race.fastestLap.car].teamId === teamId)
    breakdown.push({ label: "Fastest lap", value: 5 });
  if (results.every((r) => isClassified(r) && r.position <= 10))
    breakdown.push({ label: "Double points finish", value: 5 });
  if (results.some((r) => r.status === "dsq"))
    breakdown.push({ label: "Disqualification", value: -40 });

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
