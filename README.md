# Box Box

A browser race-strategy game set in the 2026 season. Pick a team, run both cars from the pit wall and make the calls: pit windows, tyres, pace and team orders.

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

Stack: Next.js, TypeScript, Tailwind, shadcn/ui, Vitest.

## Data

`npm run data` rebuilds `src/data/*.json` from [Jolpica](https://github.com/jolpica/jolpica-f1) (results, qualifying, standings), [OpenF1](https://openf1.org) (team colours, driver media references) and [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (circuit outlines, MIT), plus hand-curated values in `scripts/curated`. Responses are cached in `scripts/.cache`; pass `-- --refresh` to refetch.
