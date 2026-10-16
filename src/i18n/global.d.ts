import type messages from "../../messages/en.json";
import type { routing } from "./routing";

// Type-checked translation keys: a typo in t("...") is a compile error.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
