# Box Box

Browser race-strategy manager game set in the 2026 Formula 1 season: the player runs both cars of one team from the pit wall. Single-player, desktop-first, UI in English and Ukrainian. Not affiliated with Formula 1; no "F1"/"Formula 1" in the game name.

## Official images

Driver headshots, team logos and car renders come from the formula1.com CDN, and are **hotlinked only**:

- Store just the URLs in `src/data/`; never download these images into the repo or `public/`.
- Render them with a plain `<img>`, not `next/image` (it would proxy and re-host them on our domain).
- Always have a fallback: driver initials or the team name in the team colour.
- Go through `getDriverImage()` / `getTeamImage()` so the image source can be swapped in one place.

## Plan and progress

- `PLAN.md` in the repo root is the user's local plan (gitignored, never commit it). It lists the stages, the decisions made, and open questions.
- Read it at the start of a session to know where we are.
- When a stage (or a sub-item) is done, change its ⬜ to ✅ in `PLAN.md`.
- When a new decision is made with the user, add it to the "Прийняті рішення" section.

## Stack

- Next.js (App Router), TypeScript strict, Tailwind, shadcn/ui
- Vitest, ESLint, Prettier, npm
- No backend or database in the MVP. Future server code goes in Next Route Handlers (Node runtime) with Neon Postgres + Drizzle; no Express.
- Deployed to Vercel via GitHub integration: every push to `main` goes to production at https://box-box-tau.vercel.app (project `box-box`, team "Marian's projects"). The Vercel MCP connection here has read-only access; project settings changes go through the dashboard.

## Structure

- `src/engine/` - race simulation in pure TypeScript. Must not import React, Next or anything browser-specific. Deterministic: the same seed and the same player decisions always produce the same race.
- `src/data/` - generated JSON (teams, drivers, tracks, calendar), committed to the repo. Import it through `src/data/index.ts`. Never edit the JSON by hand: change `scripts/curated/*` or the script and run `npm run data`.
- `src/game/` - glue between engine and UI, no React: `RaceRunner` (real time → engine steps, position interpolation), `TrackRenderer` (Canvas 2D), timing tower rows, feed text.
- `src/app/`, `src/components/` - UI. The map redraws every animation frame outside React; the HUD re-renders about 4×/s. Flow: `/` → `/play` (team, then race setup) → `/qualifying?…` → `/race?…` (results overlay at the chequered flag). The same query (`track`, `team`, `laps`, `weather`, `seed`) is passed along, so qualifying and race build the identical race.
- Per-browser state (settings, race history) lives in localStorage via `useStored` in `src/lib/storage.ts`; never read storage during render any other way.
- `scripts/` - data collection scripts (Jolpica, OpenF1, `bacinger/f1-circuits` GeoJSON), run manually with `tsx`. The Vercel build never calls external APIs.

## Race engine

- `createRace(config)` returns a `Race`; call `step()` (0.5 s of race time) or `run()`, and `command()` for player decisions. Read state from `race.cars`, `race.order`, `race.events`.
- Separate random streams for the race, weather, mechanical failures and weekend form, so player choices never change the weather or reliability. Never use `Math.random` in the engine.
- Calibration constants live at the top of `race.ts`, `tyres.ts` and `strategy.ts`. After changing them, check `npm run sim -- --track <id> --runs 200` and the sanity test (`src/engine/sanity.test.ts`, 500 races).

## Translations (next-intl)

- Locales `en` and `uk`, always in the URL (`/en/...`, `/uk/...`); `src/proxy.ts` redirects bare paths by cookie, then browser language. Routes live under `src/app/[locale]/`.
- All UI text lives in `messages/en.json` and `messages/uk.json`, which must have identical keys (enforced by `src/game/i18n.test.ts`). Keys are type-checked against `en.json`.
- Navigation: import `Link`, `useRouter`, `redirect` from `@/i18n/navigation`, never from `next/link` / `next/navigation`, so the locale is kept.
- Game logic (`src/game`, radio, race control, advice, objectives) never builds display strings: it returns `Msg` (`{ key, values }`, values may be nested `Msg` such as tyre names). Components translate with `useMsg()`; server code with `translate()` and `getTranslations()`.
- Ukrainian needs ICU plurals (`one`/`few`/`many`/`other`). Driver names and team names stay in Latin script.

## Workflow

- Commit directly to `main`, one commit per logical step; push after each stage.
- Engine changes come with Vitest tests.
