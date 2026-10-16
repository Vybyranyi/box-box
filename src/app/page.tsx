import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    title: "The 2026 grid",
    body: "Every team and driver of the new era, rated on pace, racecraft, tyre management and wet-weather skill.",
  },
  {
    title: "Every circuit",
    body: "Real track layouts and characteristics: degradation, pit-lane loss, overtaking difficulty, Safety Car odds.",
  },
  {
    title: "You make the call",
    body: "Pit windows, tyre choices, pace modes and team orders, for both of your cars, live.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-16 px-6 py-16">
      <section className="flex flex-col items-start gap-6">
        <Badge
          variant="secondary"
          className="font-mono tracking-widest uppercase"
        >
          Pre-season testing
        </Badge>
        <h1 className="text-6xl font-black tracking-tight uppercase italic sm:text-8xl">
          Box <span className="text-primary">Box</span>
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Run the pit wall. Pick a team, read the race and make the strategy
          calls that win or lose it.
        </p>
        <Link
          href="/race?team=mclaren"
          className={buttonVariants({ size: "lg" })}
        >
          Watch a race (preview)
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <CardTitle className="font-bold uppercase">
                {feature.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {feature.body}
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
