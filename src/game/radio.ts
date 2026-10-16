import type { CarState, Race, TimedEvent } from "@/engine";
import type { FeedItem } from "./event-text";
import { lapsLeftOnTyre } from "./pit-wall";

/** Pick a line deterministically, so replays read the same. */
const pick = <T>(options: T[], seq: number) => options[seq % options.length];

const TURNS = [1, 3, 4, 7, 9, 11, 14];

function radio(
  race: Race,
  event: TimedEvent,
  from: CarState | "engineer",
  text: string,
): FeedItem {
  return {
    id: event.seq * 2 + 1,
    lap: Math.min(event.lap + 1, race.laps),
    text,
    tone: "info",
    kind: "radio",
    from: from === "engineer" ? "Engineer" : from.code,
    color: from === "engineer" ? undefined : race.team(from).color,
  };
}

/**
 * Team radio for the player's cars: drivers reacting to what happens to them, and the engineer
 * calling neutralisations. Returns null for events that don't concern the player.
 */
export function radioFor(
  race: Race,
  event: TimedEvent,
  playerTeamId: string | null,
): FeedItem | null {
  if (!playerTeamId) return null;
  const seq = event.seq;
  const own = (index: number) => {
    const car = race.cars[index];
    return car.teamId === playerTeamId ? car : null;
  };
  const anyRunning = race.cars.some(
    (c) =>
      c.teamId === playerTeamId &&
      (c.status === "racing" || c.status === "pit"),
  );

  switch (event.type) {
    case "tyre-warning": {
      const car = own(event.car);
      if (!car) return null;
      const left = lapsLeftOnTyre(race, car);
      return radio(
        race,
        event,
        car,
        pick(
          [
            "My tyres are going off.",
            "Rears are starting to go, guys.",
            `These tyres won't last much longer${left !== null ? `, ${left} laps maybe` : ""}.`,
            "Losing grip on the fronts.",
          ],
          seq,
        ),
      );
    }
    case "puncture": {
      const car = own(event.car);
      return car
        ? radio(
            race,
            event,
            car,
            pick(
              ["Puncture! I've got a puncture!", "Tyre's gone! Coming in!"],
              seq,
            ),
          )
        : null;
    }
    case "pit-exit": {
      const car = own(event.car);
      if (!car) return null;
      const t = event.stationarySeconds.toFixed(1);
      return radio(
        race,
        event,
        "engineer",
        event.slow
          ? pick(
              [
                `Sorry ${car.code}, slow stop: ${t} seconds.`,
                `Problem on the stop, ${t} seconds. Head down.`,
              ],
              seq,
            )
          : pick(
              [
                `Good stop, ${t} seconds. Let's go.`,
                `${t} seconds, nice work boys.`,
                `Clean stop, ${t}. Out-lap now.`,
              ],
              seq,
            ),
      );
    }
    case "overtake": {
      const mine = own(event.car);
      const victim = own(event.on);
      if (mine && victim) return null;
      if (mine)
        return radio(
          race,
          event,
          mine,
          pick(
            ["Yes! Got him.", "Move done.", "Get in!", "That's one more."],
            seq,
          ),
        );
      if (victim)
        return radio(
          race,
          event,
          victim,
          pick(
            [
              "He's past. Couldn't hold him.",
              "Lost a place, sorry.",
              "No grip to defend.",
            ],
            seq,
          ),
        );
      return null;
    }
    case "crash": {
      const car = own(event.car);
      return car
        ? radio(
            race,
            event,
            car,
            pick(
              [
                "I'm in the wall. Sorry guys.",
                "I'm out. Lost the rear.",
                "Big moment... car's done.",
              ],
              seq,
            ),
          )
        : null;
    }
    case "mechanical": {
      const car = own(event.car);
      return car
        ? radio(
            race,
            event,
            car,
            pick(
              [
                "I've lost power! Stopping the car.",
                "Something's broken, I have to stop.",
                "No drive, no drive!",
              ],
              seq,
            ),
          )
        : null;
    }
    case "fastest-lap": {
      const car = own(event.car);
      return car && event.lap > 1
        ? radio(
            race,
            event,
            "engineer",
            `Purple lap, ${car.code}! Fastest of the race.`,
          )
        : null;
    }
    case "sc-deployed":
      return anyRunning
        ? radio(
            race,
            event,
            "engineer",
            pick(
              [
                "Safety Car, Safety Car. Stay above delta.",
                "SC deployed. Box opportunity, thinking about it.",
              ],
              seq,
            ),
          )
        : null;
    case "vsc-deployed":
      return anyRunning
        ? radio(race, event, "engineer", "VSC, VSC. Keep the delta positive.")
        : null;
    case "green":
      return anyRunning
        ? radio(
            race,
            event,
            "engineer",
            pick(
              ["Green, green, green. Push now.", "Track is clear. Go, go, go."],
              seq,
            ),
          )
        : null;
    case "rain-start": {
      const car = race.cars.find(
        (c) => c.teamId === playerTeamId && c.status === "racing",
      );
      return car
        ? radio(
            race,
            event,
            car,
            `It's starting to rain at turn ${pick(TURNS, seq)}.`,
          )
        : null;
    }
    case "crossover":
      if (!anyRunning) return null;
      return radio(
        race,
        event,
        "engineer",
        event.to === "dry"
          ? "Track is drying. Slicks are the quicker tyre now."
          : event.to === "intermediate"
            ? "It's inter conditions now. Box for inters?"
            : "Standing water. Full wets are the tyre.",
      );
    case "finished": {
      const car = own(event.car);
      if (!car) return null;
      const p = event.position;
      const text =
        p === 1
          ? "YES! We won! Get in there!"
          : p <= 3
            ? `P${p}, podium! Great job everyone.`
            : p <= 10
              ? `P${p}. Good points today.`
              : `P${p}. Tough one, we'll come back stronger.`;
      return radio(race, event, car, text);
    }
    default:
      return null;
  }
}
