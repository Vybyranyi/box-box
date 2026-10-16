import { TyreBadge } from "@/components/race/tyre-badge";
import { buttonVariants } from "@/components/ui/button";
import type { Compound } from "@/engine";
import { cn } from "@/lib/utils";
import { Flag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "How to play · Box Box",
  description: "You run the pit wall: pit stops, tyres, pace and team orders.",
};

const TYRES: { compound: Compound; name: string; text: string }[] = [
  {
    compound: "soft",
    name: "Soft",
    text: "Fastest, but wears out quickly. Good for short stints and the last few laps.",
  },
  {
    compound: "medium",
    name: "Medium",
    text: "The all-rounder. A safe choice for the start.",
  },
  {
    compound: "hard",
    name: "Hard",
    text: "Slowest, but lasts the longest. Good for a long final stint.",
  },
  {
    compound: "intermediate",
    name: "Intermediate",
    text: "For a damp track: from about 17% wetness.",
  },
  {
    compound: "wet",
    name: "Full wet",
    text: "For heavy rain and standing water: from about 70% wetness.",
  },
];

const KEYS: [string, string][] = [
  ["Space", "Pause / resume"],
  ["1 – 5", "Speed 1× / 2× / 4× / 8× / 16×"],
  ["B", "Box the selected car this lap (press again to cancel)"],
  ["Q / E", "Select your first / second car"],
  ["Esc", "Close a pop-up and carry on"],
];

export default function HowToPlayPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-5 py-10">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="font-mono text-xs text-muted-foreground uppercase hover:text-foreground"
        >
          ← Box Box
        </Link>
        <h1 className="text-4xl font-black uppercase italic sm:text-5xl">
          How to play
        </h1>
        <p className="text-lg text-muted-foreground">
          You don&apos;t drive. You&apos;re the{" "}
          <b className="text-foreground">team principal on the pit wall</b>: the
          cars race on their own, and you make the strategy calls for both of
          your drivers. When to pit, which tyres to fit, how hard to push. Make
          better calls than the other teams and you finish higher.
        </p>
      </header>

      <Section number={1} title="Set up a race">
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>
            On the home page press <K>Start a race</K>.
          </li>
          <li>
            <b>Pick a team.</b> For your first race take a fast car like{" "}
            <b>Mercedes</b> or <b>McLaren</b>: it&apos;s easier to see the
            effect of your decisions at the front.
          </li>
          <li>
            <b>Pick a circuit, distance and weather.</b> Start with{" "}
            <K>Sprint</K> (10 laps) and <K>Dry</K>. The box on the right shows
            your <b>team objective</b>, the result your bosses expect.
          </li>
          <li>
            <b>Qualifying</b> shows where your drivers start. Press{" "}
            <K>To the grid</K>.
          </li>
          <li>
            <b>Choose starting tyres</b> for each car (the suggestion under the
            driver&apos;s name is a good default), then <K>Lights out</K>.
          </li>
        </ol>
      </Section>

      <Section number={2} title="Read the race screen">
        <ul className="flex flex-col gap-2">
          <li>
            <b>Left: the timing tower.</b> Positions, the gap to the car ahead
            (or to the leader), each car&apos;s tyre and how many laps it has
            done on it. Your cars are highlighted. Click any row to follow that
            car.
          </li>
          <li>
            <b>Centre: the map.</b> Dots are cars in their team colours; yours
            have a white ring. Cars in the pits move along the dashed pit lane.
          </li>
          <li>
            <b>Right: your pit wall.</b> One card per driver, the team orders
            and the radio.
          </li>
          <li>
            <b>Top:</b> track status (green / Safety Car), weather, pause and
            speed. A race at 1× takes as long as a real one, so play at{" "}
            <K>4×</K>–<K>8×</K>: auto-pause stops the race whenever something
            needs your decision.
          </li>
        </ul>
      </Section>

      <Section number={3} title="Your driver card">
        <ul className="flex flex-col gap-2">
          <li>
            <b>P5</b> is the position. <b>▲ +0.8</b> is the gap to the car
            ahead, <b>▼ +1.2</b> to the car behind.
          </li>
          <li>
            <b>The coloured bar</b> is tyre life: full = fresh, it shrinks as
            the tyres wear and turns red when they&apos;re nearly finished.{" "}
            <b>~45% · 8L left</b> means about 45% worn and roughly 8 laps before
            they fall off a cliff and get very slow.
          </li>
          <li>
            <b>Push / Balanced / Conserve</b> is the pace. Push is faster but
            eats tyres; Conserve is slower but they last longer.
          </li>
          <li>
            <b>The five circles</b> choose the tyre for the next stop, and{" "}
            <K>Box</K> calls the car in. It pits when it next crosses the
            start/finish line. Changed your mind? <K>Cancel</K>.
          </li>
          <li>
            <b>Plan: box ~L12 for hards</b> is advice from your strategists.
            When in doubt, follow it.
          </li>
        </ul>
      </Section>

      <Section number={4} title="The decisions that win races">
        <ul className="flex flex-col gap-3">
          <li>
            <b>Pit before the tyres die.</b> When the bar goes red, &quot;laps
            left&quot; gets close to zero, or the driver says &quot;my tyres are
            going off&quot;, it&apos;s time to box. Every stop costs about 20
            seconds, so don&apos;t stop more than you need.
          </li>
          <li>
            <b>Two compounds rule.</b> In a dry race of half distance or more
            each car must use two different dry tyres (for example medium then
            hard), so at least one stop is mandatory. Otherwise: disqualified.
          </li>
          <li>
            <b>Safety Car = cheap pit stop.</b> When the Safety Car comes out
            everyone slows down, so a stop costs about half the usual time. The
            game pauses and offers <K>Box both</K>: if a stop was coming in the
            next few laps anyway, take it.
          </li>
          <li>
            <b>Rain.</b> Watch the wetness % in the header. From about 17%
            inters are faster than slicks; in heavy rain switch to full wets.
            When the track dries, go back to slicks. Change too early or too
            late and you lose lots of time.
          </li>
          <li>
            <b>Push at the right moments:</b> to attack the car ahead, to
            defend, or in the last few laps when the tyres no longer need to
            last.
          </li>
          <li>
            <b>Team orders.</b> <K>Swap</K>: the car ahead lets its faster
            teammate through when they&apos;re close. <K>Hold</K>: your drivers
            don&apos;t fight each other.
          </li>
        </ul>
      </Section>

      <Section number={5} title="Tyres">
        <ul className="flex flex-col gap-2">
          {TYRES.map((t) => (
            <li key={t.compound} className="flex items-start gap-3">
              <TyreBadge compound={t.compound} className="mt-0.5" />
              <span>
                <b>{t.name}.</b> {t.text}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section number={6} title="Results">
        <p>
          After the chequered flag you get a grade from <b>S</b> (brilliant) to{" "}
          <b>D</b> (one to forget). It depends on whether you met the team
          objective, how your cars finished compared with what the car deserved,
          and bonuses like a podium or the fastest lap. A Williams in 9th is a
          great result; a Mercedes in 9th is not.
        </p>
      </Section>

      <Section number={7} title="Keyboard shortcuts">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          {KEYS.map(([key, action]) => (
            <div key={key} className="contents">
              <dt>
                <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">
                  {key}
                </kbd>
              </dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section number={8} title="Your first race in one minute">
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>McLaren, any circuit, Sprint, Dry.</li>
          <li>
            Start on the suggested tyres and press Lights out, then set the
            speed to 4×.
          </li>
          <li>
            Watch the &quot;Plan&quot; line on each card. When that lap comes,
            pick the suggested tyre and press Box.
          </li>
          <li>
            If the Safety Car comes out and a stop is near, press Box both.
          </li>
          <li>In the last 3 laps switch both cars to Push.</li>
        </ol>
      </Section>

      <Link
        href="/play"
        className={cn(
          buttonVariants({ size: "lg" }),
          "h-11 self-start px-5 text-base font-bold",
        )}
      >
        <Flag /> Start a race
      </Link>
    </main>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-baseline gap-3 text-2xl font-black uppercase italic">
        <span className="font-mono text-base text-primary not-italic">
          {String(number).padStart(2, "0")}
        </span>
        {title}
      </h2>
      <div className="text-[15px] leading-relaxed text-foreground/90">
        {children}
      </div>
    </section>
  );
}

/** A button or option name as it appears in the game. */
function K({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-sm font-semibold whitespace-nowrap">
      {children}
    </span>
  );
}
