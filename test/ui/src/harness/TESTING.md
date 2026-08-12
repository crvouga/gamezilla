# DST / UI simulation testing

Three layers. Keep them separate so copy renames and layout tweaks do not
rewrite scenarios.

```text
scenarios/*.sim.test.tsx
  → AppDriver / AuthFlows / ProfileFlows   (intent journeys)
    → UiPort                               (handle-keyed actions)
      → ui-testing-adapter                 (by.testId only)
        → @pkgs/ui-testing Driver
product UI
  → testID={Handles.*} from @libs/dst-handles
```

## What changes where

| Change | Touch |
|--------|--------|
| Button copy / a11y label / layout | Product UI only (scenarios stay green if handles stay put) |
| New control must be addressed | Add `Handles.*` in `@libs/dst-handles`, pass `testID={Handles.*}` in product UI, use it from a flow |
| New multi-step journey | Add / extend a flow under `harness/drivers/` |
| New behavior under test | Add a scenario that calls `AppDriver` only |

## Simulation report

`openSim` stamps one `runId` per Jest process (shared across scenario files) so
all tests from `bun run --filter @test/ui test` appear under a single run in
`@apps/simulation-report`. Override with `SIM_REPORT_RUN_ID` for cross-process
suites.

## Rules (CI)

- **Scenarios** must not import `@pkgs/ui-testing` (Biome) and must not call `by.*` (`ci:dst-selector-discipline`).
- **Drivers** (`harness/drivers/**`, `app-driver.ts`) must not use `by.text` / `by.nth` / `by.role` / `by.label`.
- **Adapter** may use `by.testId` only. `UiPort.tap` / `input` auto-wait until visible.

## Adding a scenario

1. Copy [`new-sim-test.template.ts`](./new-sim-test.template.ts).
2. Prefer existing `app.auth.*` / `app.profile.*` flows.
3. If a step is missing, add a flow method that uses `Handles` + `UiPort` — do not reach for `by.*` in the scenario.

## Adding a handle

1. Add the id to `Handles` in `@libs/dst-handles`.
2. Thread `testID` on the product control (and on `@pkgs/ui` primitives if the prop is missing).
3. Reference `Handles.foo` from a driver — never hard-code the string in scenarios.
