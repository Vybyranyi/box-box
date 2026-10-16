import type { Race, TimedEvent } from "@/engine";

/** Sound effects the race can trigger; the browser sound board decides how they sound. */
export type Cue =
  | "lightsOut"
  | "overtakeGain"
  | "overtakeLoss"
  | "pitStop"
  | "safetyCar"
  | "green"
  | "boost"
  | "rain"
  | "fastestLap"
  | "chequered";

/**
 * Which sounds a batch of engine events should play. Only what matters to the player: their
 * own cars' passes, stops and boosts, plus race-wide moments (start, Safety Car, flag).
 */
export function cuesFor(
  race: Race,
  events: TimedEvent[],
  playerTeamId: string | null,
): Cue[] {
  const own = (index: number) =>
    playerTeamId !== null && race.cars[index].teamId === playerTeamId;
  const cues = new Set<Cue>();
  for (const e of events) {
    switch (e.type) {
      case "start":
        cues.add("lightsOut");
        break;
      case "overtake":
        if (own(e.car) && !own(e.on)) cues.add("overtakeGain");
        else if (own(e.on) && !own(e.car)) cues.add("overtakeLoss");
        break;
      case "pit-entry":
        if (own(e.car)) cues.add("pitStop");
        break;
      case "sc-deployed":
      case "vsc-deployed":
        cues.add("safetyCar");
        break;
      case "green":
        cues.add("green");
        break;
      case "boost":
        if (own(e.car) && e.kind === "attack") cues.add("boost");
        break;
      case "rain-start":
        cues.add("rain");
        break;
      case "fastest-lap":
        if (own(e.car) && e.lap > 1) cues.add("fastestLap");
        break;
      case "chequered-flag":
        cues.add("chequered");
        break;
    }
  }
  return [...cues];
}
