"use client";

import { translate, type Msg, type Translate } from "@/game/messages";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

/** Translate game-logic messages (`Msg`) in client components. */
export function useMsg(): (message: Msg) => string {
  const t = useTranslations() as unknown as Translate;
  return useCallback((message: Msg) => translate(t, message), [t]);
}
