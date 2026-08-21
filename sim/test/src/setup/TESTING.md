# Sim tests (DST)

Product system graph lives in `@libs/runtime`. Open a world with `openSim` from
`sim/test/src/setup/open-sim.ts`.

**Fidelity** (`openSim(id, { fidelity })` or `SIM_FIDELITY`):

- `sim` (default) — server `@crvouga/postgres-mem` + client sqlite-mem /
  in-memory leaves / in-process RNTL driver. World mesh (`partition`, crash) is
  first-class.
- `max` — `SIM_FIDELITY=max` / `bun run --filter @sim/test test:max`.
  World-mesh scenarios skip. Server is embedded real Postgres via
  `tools/scripts/boot-local-stack.ts` (plus MinIO/EMQX when needed). Playwright
  needs an injected page (`PLAYWRIGHT_BASE_URL` / driver wiring); default max
  still uses the in-process driver until that URL is set.

View captured timelines in **`bun run dev`** (`@sim/console` → Reports).
Reports are served from `<repo>/.cache/sim-console-data` on port 7789.
`openSim` writes into that directory. Production browsing of reports stays on
the API Worker `/sim-console` mount (B2).

Do not use a local Wrangler + API Worker stack for manual feature work. That is
CI / production, not `bun dev`.
