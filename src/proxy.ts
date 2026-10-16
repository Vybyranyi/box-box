import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/** Redirects / to /en or /uk (by cookie, then browser language) and keeps the locale in every URL. */
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next/Vercel internals and files with an extension.
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
