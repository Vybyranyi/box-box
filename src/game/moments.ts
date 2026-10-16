import { isDry, type Race } from "@/engine";
import { battleInsight, undercutInsight } from "./insights";
import { msg, type Msg } from "./messages";

/** Something that decided the player's race, for the results screen. */
export type Moment = {
  lap: number;
  tone: "good" | "bad";
  message: Msg;
  /** How much it mattered; the results screen shows the heaviest few. */
  weight: number;
};

/** How many moments the results screen shows. */
export const MAX_MOMENTS = 6;
/** Tyre wear above which the stint clearly ran too long, %. */
const WORN_OUT = 86;

type Offer = { lap: number; rival: number; value: number };

/**
 * Watches the player's race and keeps the moments worth talking about afterwards: undercuts
 * taken or missed, Overtake Mode chances, stops under the Safety Car, the start, worn-out tyres.
 * Call `observe` as the race runs (after each batch of steps) and `finish` at the flag.
 */
export class MomentLog {
  private moments: Moment[] = [];
  private seen = 0;
  /** Latest undercut chance per car index, while it lasts. */
  private undercutOffers = new Map<number, Offer>();
  /** Undercuts taken: resolved when the rival comes out of its own stop. */
  private undercuts: {
    car: number;
    rival: number;
    lap: number;
    rivalStopping: boolean;
  }[] = [];
  /** Overtake Mode chances per car index that haven't been used yet. */
  private boostOffers = new Map<number, Offer>();
  /** Defend deployments still running: did the attacker get past? */
  private defences: {
    car: number;
    rival: number;
    lap: number;
    lost: boolean;
  }[] = [];
  /** Player cars that had a stop due when the current neutralisation began. */
  private stopDueUnderSc = new Map<number, number>();
  private wornOut = new Set<string>();
  private startDone = false;

  constructor(private readonly teamId: string) {}

  observe(race: Race): void {
    const own = (index: number) => race.cars[index].teamId === this.teamId;
    const code = (index: number) => race.cars[index].code;

    for (; this.seen < race.events.length; this.seen++) {
      const e = race.events[this.seen];
      switch (e.type) {
        case "overtake": {
          if (own(e.car) && !own(e.on)) {
            const boosted = race.cars[e.car].boost?.kind === "attack";
            this.add(e.lap, "good", boosted ? 3 : 1, "overtake", {
              car: code(e.car),
              rival: code(e.on),
              boosted: boosted ? "yes" : "no",
            });
            this.boostOffers.delete(e.car);
          }
          for (const d of this.defences)
            if (d.car === e.on && d.rival === e.car) d.lost = true;
          break;
        }
        case "boost":
          if (own(e.car) && e.kind === "attack") this.boostOffers.delete(e.car);
          if (own(e.car) && e.kind === "defend")
            this.defences.push({
              car: e.car,
              rival: e.target,
              lap: e.lap,
              lost: false,
            });
          break;
        case "pit-entry": {
          if (!own(e.car)) {
            for (const u of this.undercuts)
              if (u.rival === e.car) u.rivalStopping = true;
            break;
          }
          const stop = race.cars[e.car].pitStops.at(-1)!;
          if (stop.underSafetyCar) {
            this.add(e.lap, "good", 4, "scStop", { car: code(e.car) });
          }
          this.stopDueUnderSc.delete(e.car);
          const offer = this.undercutOffers.get(e.car);
          if (offer && race.cars[e.car].lap - offer.lap <= 1)
            this.undercuts.push({
              car: e.car,
              rival: offer.rival,
              lap: e.lap,
              rivalStopping: false,
            });
          this.undercutOffers.delete(e.car);
          break;
        }
        case "pit-exit": {
          // The rival is out of its own stop: did the undercut get us ahead?
          const resolved = this.undercuts.filter(
            (u) => u.rival === e.car && u.rivalStopping,
          );
          for (const u of resolved) {
            const ahead =
              race.cars[u.car].position < race.cars[u.rival].position;
            this.add(
              u.lap,
              ahead ? "good" : "bad",
              ahead ? 4 : 2,
              ahead ? "undercutWon" : "undercutFailed",
              { car: code(u.car), rival: code(u.rival) },
            );
          }
          this.undercuts = this.undercuts.filter((u) => !resolved.includes(u));
          break;
        }
        case "sc-deployed":
          for (const car of race.cars) {
            if (car.teamId !== this.teamId || car.status !== "racing") continue;
            const plan = race.suggestStrategy(car);
            const dueSoon =
              isDry(car.tyre.compound) &&
              plan.stints.length > 1 &&
              plan.stints[0].endLap - car.lap <= 10;
            if (dueSoon || car.tyre.wear >= 45)
              this.stopDueUnderSc.set(car.index, e.lap);
          }
          break;
        case "green":
          for (const [index, lap] of this.stopDueUnderSc)
            if (race.cars[index].status === "racing")
              this.add(lap, "bad", 3, "scMissed", { car: code(index) });
          this.stopDueUnderSc.clear();
          break;
        case "puncture":
          if (own(e.car))
            this.add(e.lap, "bad", 4, "puncture", { car: code(e.car) });
          break;
        case "disqualified":
          if (own(e.car))
            this.add(e.lap, "bad", 8, "dsq", { car: code(e.car) });
          break;
      }
    }

    // The start: places gained or lost on the opening lap.
    if (!this.startDone && race.leaderLap >= 1) {
      this.startDone = true;
      for (const car of race.cars) {
        if (car.teamId !== this.teamId || car.status === "retired") continue;
        const places = car.gridPosition - car.position;
        if (Math.abs(places) >= 2)
          this.add(
            1,
            places > 0 ? "good" : "bad",
            2,
            places > 0 ? "goodStart" : "badStart",
            {
              car: car.code,
              places: Math.abs(places),
            },
          );
      }
    }

    for (const car of race.cars) {
      if (car.teamId !== this.teamId || car.status !== "racing") continue;

      // Chances on offer right now.
      const undercut = undercutInsight(race, car);
      if (undercut?.message.key === "insight.undercutOn") {
        const rival = race.cars.find(
          (c) => c.code === undercut.message.values?.car,
        );
        if (rival && !this.undercutOffers.has(car.index))
          this.undercutOffers.set(car.index, {
            lap: car.lap,
            rival: rival.index,
            value: Number(undercut.message.values?.gain ?? 0),
          });
      }
      const tip = battleInsight(race, car)?.tip;
      if (
        tip?.key === "insight.tipOvertake" &&
        !this.boostOffers.has(car.index)
      ) {
        const ahead = race.cars[race.order[car.position - 2]];
        this.boostOffers.set(car.index, {
          lap: car.lap,
          rival: ahead.index,
          value: Number(tip.values?.chance ?? 0),
        });
      }

      // Chances that went by.
      const offer = this.undercutOffers.get(car.index);
      if (offer && car.lap - offer.lap > 2) {
        this.add(offer.lap, "bad", 2, "undercutMissed", {
          car: car.code,
          rival: code(offer.rival),
          gain: offer.value.toFixed(1),
        });
        this.undercutOffers.delete(car.index);
      }
      const boost = this.boostOffers.get(car.index);
      if (boost && car.lap - boost.lap > 1) {
        if (race.cars[boost.rival].position < car.position)
          this.add(boost.lap, "bad", 2, "boostMissed", {
            car: car.code,
            rival: code(boost.rival),
            chance: boost.value,
          });
        this.boostOffers.delete(car.index);
      }

      const stintKey = `${car.index}:${car.stints.length}`;
      if (
        isDry(car.tyre.compound) &&
        car.tyre.wear >= WORN_OUT &&
        !this.wornOut.has(stintKey)
      ) {
        this.wornOut.add(stintKey);
        this.add(car.lap, "bad", 3, "tyresTooLong", {
          car: car.code,
          wear: Math.round(car.tyre.wear),
        });
      }
    }

    // Defend deployments that have run out: held on, or not.
    const over = this.defences.filter((d) => !race.cars[d.car].boost);
    for (const d of over)
      if (!d.lost)
        this.add(d.lap, "good", 2, "defended", {
          car: code(d.car),
          rival: code(d.rival),
        });
    this.defences = this.defences.filter((d) => !over.includes(d));
  }

  /** The moments to show at the flag: the heaviest few, in race order. */
  finish(race: Race): Moment[] {
    this.observe(race);
    // Ordinary passes (weight 1) only make the list when there's little else to say.
    const ranked = [...this.moments].sort(
      (a, b) => b.weight - a.weight || a.lap - b.lap,
    );
    return ranked.slice(0, MAX_MOMENTS).sort((a, b) => a.lap - b.lap);
  }

  private add(
    lap: number,
    tone: Moment["tone"],
    weight: number,
    key: string,
    values: Msg["values"],
  ) {
    this.moments.push({
      lap: Math.max(1, lap),
      tone,
      weight,
      message: msg(`moments.${key}`, values),
    });
  }
}
