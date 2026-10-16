# Box Box

A browser race-strategy game set in the 2026 season. Pick a team, run both cars from the pit wall and make the calls: pit windows, tyres, pace and team orders.

**Play: [box-box-tau.vercel.app](https://box-box-tau.vercel.app)**

Fan-made, non-commercial, and not affiliated with Formula 1 or any team.

## Development

```bash
npm install
npm run dev
```

| Script              | What it does                    |
| ------------------- | ------------------------------- |
| `npm run dev`       | Dev server on `localhost:3000`  |
| `npm run build`     | Production build                |
| `npm test`          | Engine tests (Vitest)           |
| `npm run lint`      | ESLint                          |
| `npm run typecheck` | TypeScript                      |
| `npm run format`    | Prettier                        |
| `npm run data`      | Regenerate `src/data` from APIs |
| `npm run sim`       | Simulate races in the terminal  |

Stack: Next.js, TypeScript, Tailwind, shadcn/ui, Vitest.

## Race engine

`src/engine` is a deterministic race simulation in plain TypeScript: the same seed and the same commands always give the same race. Try it from the terminal:

```bash
npm run sim -- --track monza --seed 7
npm run sim -- --track monaco --weather mixed
npm run sim -- --track silverstone --runs 200
```

## Data

`npm run data` rebuilds `src/data/*.json` from [Jolpica](https://github.com/jolpica/jolpica-f1) (results, qualifying, standings), [OpenF1](https://openf1.org) (team colours, driver media references) and [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (circuit outlines, MIT), plus hand-curated values in `scripts/curated`. Responses are cached in `scripts/.cache`; pass `-- --refresh` to refetch.
