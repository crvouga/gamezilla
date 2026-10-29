# Mockingbird migration

Local development and tests should exercise vendor clients against Mockingbird,
with isolated in-process runtimes where possible and mock listeners when another
process needs a protocol endpoint. Do not patch installed dependencies or add
consumer-side simulations of missing vendor behavior. Report gaps using the
[Mockingbird issue guide](https://github.com/crvouga/mockingbird/blob/main/docs/REPORTING_ISSUES.md).

This migration is **not ready for release**. Some verifications below remain red on the
published package versions; a green `bun verify` remains the release decision.

| Integration | Current migration state | Evidence or blocker |
| --- | --- | --- |
| Postgres | Native package, bootstrap/recovery code and install hooks removed; local/contract callers now use `@pkgs/postgres-mockingbird-server-ts` and Mockingbird 2.3.0 | Startup, port isolation and orderly restart verifications pass; full wire contracts fail on the gaps below |
| SQLite | Existing Mockingbird client engine retained | `@pkgs/sql-client-sqlite-root-shared-ts` |
| Server KV | Harness now uses the production Postgres-backed adapter over its Mockingbird database | All five KV port contract tests pass; no separate Redis service is needed |
| OAuth / Stripe | Local Google and Stripe journeys pass against Mockingbird; Apple handoff remains blocked | [Apple form-post redirect #348](https://github.com/crvouga/mockingbird/issues/348): automatic callback consumes the response but the browser remains on the handoff page; restricted CSP is the suspected cause |
| Paddle | Catalog uses `@crvouga/mockingbird-service-paddle` 2.1.0 for portal sessions and notification settings | [Portal sessions #327](https://github.com/crvouga/mockingbird/issues/327) and [notification settings #328](https://github.com/crvouga/mockingbird/issues/328) are served. The production client assertions stay in `pkgs/billing-paddle-harness-ts/tests/mockingbird-gaps.test.ts` |
| OpenAI | Harness now uses the production OpenAI adapter against Mockingbird 0.1.0; local stack starts a mock server and overrides its key/base URL | Scripted structured-response integration verification passes. Configure synthetic models/scripts rather than expecting semantic inference |
| S3 | Existing local Mockingbird service retained; harness routes the real S3 adapter to an isolated in-process Mockingbird runtime | Binary round-trip and isolation regression now passes under Bun browser conditions. Install generates the adapter's browser bundle; Bun selects it through conditional package exports. The production Worker and ordinary Node/Bun imports retain the source adapter |
| MQTT / EMQX | Aedes/local EMQX and the harness bus still require replacement | No published Mockingbird MQTT package; [#316](https://github.com/crvouga/mockingbird/issues/316) specifies MQTT 5, TCP/WS, JWT ACLs and session buffering |
| AWS IoT | Production publisher still needs a vendor-compatible mock | [#323](https://github.com/crvouga/mockingbird/issues/323) specifies SigV4 HTTP Publish and MQTT behavior |
| ElevenLabs | Harness TTS stub still requires replacement | No published mock; [#322](https://github.com/crvouga/mockingbird/issues/322) specifies actual audio formats and errors |
| OTLP / Tempo | Existing file collector / optional LGTM stack still require replacement | [#324](https://github.com/crvouga/mockingbird/issues/324) requests collector auth modes; [#325](https://github.com/crvouga/mockingbird/issues/325) requests Tempo query parity |

## Postgres gaps

| Missing behavior | Upstream issue | Pinned regression |
| --- | --- | --- |
| Startup `options=-c search_path=...` (Bun driver; node-pg pools explicitly pin each new session) | [#317](https://github.com/crvouga/mockingbird/issues/317) | `pkgs/sql-client-postgres-server-ts/tests/postgres.contract.test.ts` |
| `ALTER COLUMN SET NOT NULL` | [#318](https://github.com/crvouga/mockingbird/issues/318) | `pkgs/postgres-mockingbird-server-ts/tests/ddl-gaps.test.ts` |
| `ALTER COLUMN SET DEFAULT` | [#319](https://github.com/crvouga/mockingbird/issues/319) | `pkgs/postgres-mockingbird-server-ts/tests/ddl-gaps.test.ts` |
| `pg_stat_user_tables` | [#320](https://github.com/crvouga/mockingbird/issues/320) | `pkgs/postgres-mockingbird-server-ts/tests/ddl-gaps.test.ts` |
| `pg_index.indisvalid` and interrupted index state | [#326](https://github.com/crvouga/mockingbird/issues/326) | `libs/runtime-server-ts/tests/mockingbird-reconcile.contract.test.ts` |
| Crash-safe durable wire commits | [#321](https://github.com/crvouga/mockingbird/issues/321) | Feature request; current adapter only stores snapshots on orderly shutdown |

Full application reconciliation stays in `@libs/runtime-server-ts`'s automated
contract suite rather than the workspace Run hook. Run launches the dev stack;
it does not turn dependency-installation or contract-runner failures into a
workspace-launch failure. Catalog query failures are propagated immediately;
they are no longer treated as an empty invalid-index set, which previously hid
the original error behind transaction-aborted `25P02`.

## Upstream reconciliation fix

The [reviewable upstream patch](https://github.com/crvouga/mockingbird/issues/326#issuecomment-5996749374)
and a local Mockingbird checkout beside this repository contain a tested source
fix for `indisvalid`, distinct index OIDs and definitions, index comments,
namespace casts, statistics catalogs, and the parser consuming `SET` before
`SET DEFAULT` / `SET NOT NULL` could execute. Failed initial concurrent unique
builds retain invalid catalog entries; wire transaction errors still abort
transactions, and snapshots preserve validity and index metadata.

The upstream Postgres package's `bun run verify:full` passed: format, lint,
typecheck, 3,563 compatibility tests, build, package validation and portability.
Its separate wire suite passed 27 tests. The product's full reconciliation
contract and eight pinned DDL/catalog inputs passed against the built package
through a temporary test preload (nine tests total).
That preload is verification only: installed dependencies, catalog versions and
the workspace launcher still use the published package.

Additional upstream issues track namespace casts
([#329](https://github.com/crvouga/mockingbird/issues/329)), index identities and
definitions ([#330](https://github.com/crvouga/mockingbird/issues/330)), and
index comments ([#331](https://github.com/crvouga/mockingbird/issues/331)).
Optional startup operations exposed further gaps: storage modes
([#332](https://github.com/crvouga/mockingbird/issues/332)), unlogged tables
([#333](https://github.com/crvouga/mockingbird/issues/333)), and extension
catalogs ([#334](https://github.com/crvouga/mockingbird/issues/334)).

This source fix has limited parity: table statistics use exact live row counts,
index usage counts the mock's actual unique lookups, constraint-backed catalog
indexes and complete index deparsing need more work, and late concurrent build
interruptions are not simulated. Those gaps remain upstream work, not claims of
full PostgreSQL fidelity or a green workspace `bun verify`.

The local adapter stores an atomic `database.pgmm` snapshot through an object
store when stopped normally. An abrupt process exit can lose writes after the
last snapshot. Existing native cluster directories are left untouched and are
not automatically imported; the first Mockingbird database starts fresh.

## Automated validation

- `bun run --filter @apps/product-ts test`: 184 passed, zero failed.
- New Postgres listener/restart verifies: two passed. The eight SQL catalog/DDL
  regression verifications remain red on Mockingbird 2.3.0.
- Postgres client tests: ten passed; typecheck and lint passed. Its wire
  contracts: eight passed, one failed on Bun startup `search_path` handling.
  `createPgPool` now installs its documented awaited `onConnect` schema pin;
  the new concurrent-checkout regression passes. The Bun contract owns a
  separate wire server so earlier node-pg tests cannot hide its startup gap.
  Matchmaking's tests pass the schema pin and now expose `i.indisvalid` instead
  (22 passed, four failed).
- Server KV contracts: five passed against in-process Mockingbird Postgres.
- OpenAI and S3 adapter verifies: both passed under the harness's browser conditions.
- S3 adapter typecheck and lint passed; its six unit/property verifications and ten
  wire contracts passed. The Postgres schema package's import-order lint
  failure is corrected and its lint passes.
- Full application reconciliation and Postgres schema/index/concurrency contracts
  remain red on the documented gaps. The Paddle portal and notification-setting
  verifications pass on `@crvouga/mockingbird-service-paddle` 2.1.0.
- Type verifications passed for the new Postgres packages and the affected product,
  server, runtime, harness, SQL client, schema, index, sync harness and Paddle
  harness packages. Package lint, naming and whitespace verifications passed.

No green full `bun verify` verdict is claimed. The migration cannot complete
until the missing services and wire behavior are available.

## Reverify after upstream releases

Update the catalog versions and run the service's verifications plus the affected
wire contracts. Keep the literal regression assertions; never skip them or
pretend the missing SQL succeeded. Verify the full application reconciliation,
index and concurrency paths before claiming the dev/test migration is complete.
The recorded commands and results cover automated tests only.
