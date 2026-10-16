import en from "../../messages/en.json";
import uk from "../../messages/uk.json";
import { createTranslator } from "next-intl";
import { translate, type Msg, type Translate } from "./messages";

export const MESSAGES = { en, uk } as const;

/**
 * Test helper: translate a game message in a locale, throwing on a missing key or a bad
 * placeholder instead of silently printing the key.
 */
export function tr(message: Msg, locale: keyof typeof MESSAGES = "en"): string {
  const t = createTranslator({
    locale,
    messages: MESSAGES[locale],
    onError: (error) => {
      throw error;
    },
  });
  return translate(t as unknown as Translate, message);
}
