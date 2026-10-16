"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";

const LABELS: Record<(typeof routing.locales)[number], string> = {
  en: "EN",
  uk: "УКР",
};

/** EN / УКР toggle that keeps the current page (and its query, when given). */
export function LocaleSwitcher({
  query,
  className,
}: {
  query?: string;
  className?: string;
}) {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const href = query ? `${pathname}?${query}` : pathname;

  return (
    <div
      className={cn("flex rounded-lg bg-muted p-0.5", className)}
      role="group"
      aria-label={t("language")}
    >
      {routing.locales.map((l) => (
        <Link
          key={l}
          href={href}
          locale={l}
          aria-current={l === locale ? "true" : undefined}
          className={cn(
            "rounded-md px-2 py-1 font-mono text-[11px] font-bold transition-colors",
            l === locale
              ? "bg-background text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {LABELS[l]}
        </Link>
      ))}
    </div>
  );
}
