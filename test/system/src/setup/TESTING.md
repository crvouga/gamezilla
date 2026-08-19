# System tests (DST)

Product system graph lives in `@libs/runtime`. Open a world with `openSim` from
`test/system/src/setup/open-sim.ts`.

**Fidelity** (`openSim(id, { fidelity })` or `SYSTEM_FIDELITY`):

- `sim` (default) — sqlite-mem / in-memory leaves / in-process RNTL driver.
  World mesh (`partition`, crash) is first-class.
- `max` — `SYSTEM_FIDELITY=max` / `bun run --filter @test/system test:max`.
  World-mesh scenarios skip. Use this lane plus port contract matrices (and
  `tools/scripts/boot-local-stack.ts` when you need real Postgres/MinIO/EMQX).
  Playwright needs an injected page (`PLAYWRIGHT_BASE_URL` / driver wiring);
  default max still uses the in-process driver until that URL is set.

View captured timelines in **`bun dev`** (`@apps/client` Console → Reports).
Reports are served from `<repo>/system-console-data` on port 7789.
`openSim` writes into that directory. Production browsing of reports stays on
the API Worker `/system-console` mount (B2).

Do not use a local Wrangler + API Worker stack for manual feature work. That is
CI / production, not `bun dev`.
