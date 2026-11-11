/**
 * Per test, a wall clock for anything that opens a product world. A scenario
 * costs 2–5 s idle (a Battleship lineup alone: two people sign in, a space,
 * a custom game, both seats), but under a full `bun verify` (every package's
 * spec plus the Quint models at once) chess scenarios measured 60–95 s, and
 * under coverage instrumentation a Battleship setup test measured 4.5–5.0 s,
 * past bun's 5 s default. 240 s is over twice the loaded cost, so load cannot
 * flip a verdict; the per-task budget still bounds a hang. A live browser
 * (`HARNESS_MODE=real|stack`) gets the same.
 *
 * `test-spec.ts` passes it as `--timeout`; `@libs/harness-ts/preload` makes it
 * the default for every package `bun test` (and so `verify:coverage`) too.
 */
export const PRODUCT_HARNESS_TIMEOUT_MS = 240_000;
