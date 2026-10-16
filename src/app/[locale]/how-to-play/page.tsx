import { LocaleSwitcher } from "@/components/locale-switcher";
import { TyreBadge } from "@/components/race/tyre-badge";
import { buttonVariants } from "@/components/ui/button";
import type { Compound } from "@/engine";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Flag } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("howTo") };
}

const TYRES: Compound[] = ["soft", "medium", "hard", "intermediate", "wet"];
const KEYS = [
  ["Space", "space"],
  ["1 – 5", "speed"],
  ["B", "box"],
  ["Q / E", "car"],
  ["O / D", "boost"],
  ["Y / N", "answer"],
  ["Esc", "esc"],
] as const;

/** Inline formatting tags available in the guide's messages. */
const tags = {
  b: (chunks: ReactNode) => <b className="text-foreground">{chunks}</b>,
  k: (chunks: ReactNode) => (
    <span className="rounded bg-muted px-1.5 py-0.5 text-sm font-semibold whitespace-nowrap">
      {chunks}
    </span>
  ),
};

export default async function HowToPlayPage() {
  const [t, tTyres, tCommon] = await Promise.all([
    getTranslations("howTo"),
    getTranslations("tyres"),
    getTranslations("common"),
  ]);
  const items = (
    section: "setup" | "screen" | "card" | "decisions" | "first",
    count: number,
  ) =>
    Array.from({ length: count }, (_, i) =>
      t.rich(`${section}.${i + 1}` as `setup.1`, tags),
    );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-5 py-10">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="font-mono text-xs text-muted-foreground uppercase hover:text-foreground"
          >
            {tCommon("back")}
          </Link>
          <LocaleSwitcher />
        </div>
        <h1 className="text-4xl font-black uppercase italic sm:text-5xl">
          {t("title")}
        </h1>
        <p className="text-lg text-muted-foreground">{t.rich("intro", tags)}</p>
      </header>

      <Section number={1} title={t("setup.title")}>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          {items("setup", 6).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      </Section>

      <Section number={2} title={t("screen.title")}>
        <ul className="flex flex-col gap-2">
          {items("screen", 5).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section number={3} title={t("card.title")}>
        <ul className="flex flex-col gap-2">
          {items("card", 8).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section number={4} title={t("decisions.title")}>
        <ul className="flex flex-col gap-3">
          {items("decisions", 7).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section number={5} title={t("tyres.title")}>
        <ul className="flex flex-col gap-2">
          {TYRES.map((c) => (
            <li key={c} className="flex items-start gap-3">
              <TyreBadge compound={c} className="mt-0.5" />
              <span>
                <b>{tTyres(c)}.</b> {t(`tyres.${c}`)}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section number={6} title={t("results.title")}>
        <p>{t.rich("results.body", tags)}</p>
        <p>{t.rich("results.moments", tags)}</p>
      </Section>

      <Section number={7} title={t("keys.title")}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          {KEYS.map(([key, action]) => (
            <div key={key} className="contents">
              <dt>
                <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">
                  {key}
                </kbd>
              </dt>
              <dd>{t(`keys.${action}`)}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section number={8} title={t("first.title")}>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          {items("first", 5).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      </Section>

      <Link
        href="/play"
        className={cn(
          buttonVariants({ size: "lg" }),
          "h-11 self-start px-5 text-base font-bold",
        )}
      >
        <Flag /> {t("start")}
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
