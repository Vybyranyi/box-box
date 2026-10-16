"use client";

import { ENGINEER, type FeedItem } from "@/game/event-text";
import { useMsg } from "@/i18n/use-msg";
import { cn } from "@/lib/utils";
import { Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Filter = "all" | "radio" | "control";

/** Team radio and race control messages, newest first. */
export function RaceFeed({ feed }: { feed: FeedItem[] }) {
  const t = useTranslations("feed");
  const translate = useMsg();
  const [filter, setFilter] = useState<Filter>("all");
  const items = filter === "all" ? feed : feed.filter((f) => f.kind === filter);

  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card"
      aria-label={t("label")}
    >
      <header className="flex items-center justify-between border-b px-3 py-1.5">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase">
          {t("title")}
        </h2>
        <div className="flex rounded-md bg-muted p-0.5 text-[10px] font-semibold uppercase">
          {(["all", "radio", "control"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded px-1.5 py-0.5",
                filter === f
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(f)}
            </button>
          ))}
        </div>
      </header>
      <ol className="flex min-h-0 flex-col gap-1 overflow-y-auto p-2 text-sm">
        {items.length === 0 && (
          <li className="px-1 text-muted-foreground">{t("empty")}</li>
        )}
        {items.map((item) =>
          item.kind === "radio" ? (
            <li
              key={item.id}
              className="flex gap-2 rounded-md border-l-2 bg-muted/60 px-2 py-1"
              style={{
                borderLeftColor: item.color ?? "var(--muted-foreground)",
              }}
            >
              <span className="w-8 shrink-0 font-mono text-xs leading-5 text-muted-foreground">
                L{item.lap}
              </span>
              <span className="min-w-0">
                <span className="mr-1.5 inline-flex items-center gap-1 font-mono text-xs font-bold">
                  <Radio className="size-3" />
                  {item.from === ENGINEER ? t("engineer") : item.from}
                </span>
                <span className="italic">“{translate(item.message)}”</span>
              </span>
            </li>
          ) : (
            <li key={item.id} className="flex gap-2 rounded px-2 py-0.5">
              <span className="w-8 shrink-0 font-mono text-xs leading-5 text-muted-foreground">
                L{item.lap}
              </span>
              <span
                className={cn(
                  item.tone === "warning" && "text-amber-300",
                  item.tone === "danger" && "text-red-400",
                  item.tone === "good" && "text-emerald-400",
                )}
              >
                {translate(item.message)}
              </span>
            </li>
          ),
        )}
      </ol>
    </section>
  );
}
