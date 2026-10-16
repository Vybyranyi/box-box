import { HomeActions } from "@/components/home/home-actions";
import { RecentRaces } from "@/components/home/recent-races";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { meta } from "@/data";
import { getTranslations } from "next-intl/server";

const FEATURES = ["grid", "circuits", "calls"] as const;

export default async function Home() {
  const t = await getTranslations("home");
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-14 px-6 py-16">
      <LocaleSwitcher className="fixed top-4 right-4" />
      <section className="flex flex-col items-start gap-6">
        <Badge
          variant="secondary"
          className="font-mono tracking-widest uppercase"
        >
          {t("season", { season: meta.season })}
        </Badge>
        <h1 className="text-6xl font-black tracking-tight uppercase italic sm:text-8xl">
          Box <span className="text-primary">Box</span>
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">{t("tagline")}</p>
        <HomeActions />
      </section>

      <RecentRaces />

      <section className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((key) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="font-bold uppercase">
                {t(`features.${key}.title`)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {t(`features.${key}.body`)}
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
