# Box Box

Browser race-strategy manager game set in the 2026 Formula 1 season: the player runs both cars of one team from the pit wall. Single-player, desktop-first, English UI. Not affiliated with Formula 1; no "F1"/"Formula 1" in the game name.

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
- Deployed to Vercel via GitHub integration.

## Structure

- `src/engine/` - race simulation in pure TypeScript. Must not import React, Next or anything browser-specific. Deterministic: the same seed and the same player decisions always produce the same race.
- `src/data/` - generated JSON (teams, drivers, tracks, calendar), committed to the repo. Import it through `src/data/index.ts`. Never edit the JSON by hand: change `scripts/curated/*` or the script and run `npm run data`.
- `src/app/`, `src/components/` - UI. The race map is drawn with Canvas 2D; the HUD is React.
- `scripts/` - data collection scripts (Jolpica, OpenF1, `bacinger/f1-circuits` GeoJSON), run manually with `tsx`. The Vercel build never calls external APIs.

## Workflow

- Commit directly to `main`, one commit per logical step; push after each stage.
- Engine changes come with Vitest tests.
