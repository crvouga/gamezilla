# Check cache audit

Audit of the slow Check at `993fcf740520562fcb7e4f37a76ebf7cbd8a653f`.
Release/check policy: [repository briefing](../../../README.md#correctness-machinery).

## Causes and fixes

- The slow run used a temporary `local:w,remote:w` diagnostic override.
  `w` writes but never reads; `rw` reads and writes. The wrapper already
  defaulted to read/write. Check now enforces that mode **after** secrets
  injection, protecting it from environment overrides. The diagnostic
  write-only mode remains available for controlled cold measurements.
- `actions/cache@v5` rejects events without `GITHUB_REF`, including Depot API
  triggers. Both dependency cache actions were removed. The measured cold
  frozen install was 1.62s; mise tool caching and Turbo remote caching remain.
  No synthetic ref, fallback dependency key, or incompatible tree restore.
- Preflight now honors `resolvedTaskDefinition.cache: false`. The online
  advisory audit always executes, even if an older cache artifact exists.
- Build hashes now cover toolchain pins, public Vite environment values,
  `ANALYZE`, client dotenv files, translation catalogs, module configs, and
  shared Lingui configs and the root catalog compilation command. Vite embeds the whole public environment object;
  its commit metadata and dates genuinely change bundle bytes. Other tasks
  do not hash those values. Offline-shell verification relies on its build
  dependency's hash instead of hashing generated `dist` before restoration.
- Cached S3, Postgres, and EMQX contracts now always use private local
  sidecars. The S3 suite also uses a fresh seeded namespace per test. An
  additional concurrency sample exposed `['a/x','a/y','b','k']` where the
  listing expected `['a/x','a/y','b']`: concurrent runs had selected the same
  remote bucket and prefix through injected credentials. This is fixed,
  pinned as a regression, and never retried to hide it.

## Mode syntax and configuration sources

`resolveCacheFlag` accepts one or two comma-separated `local:` / `remote:`
entries with a suffix of `r`, `w`, `rw`, or empty (disabled). It trims the
whole string; unsupported forms fall back to `local:rw,remote:rw`. With a
token, a missing remote entry is appended as `remote:rw`; remote-only input
gets `local:rw`. Without a token the existing fallback is `local:rw`.

The regex also admits duplicate store entries; this audit did not change
that existing parser behavior. Normal Check supplies one entry per store.
Tests cover valid suffixes/defaults and real Turbo proves both remote
read/write restoration and write-only execution.

Tracked `TURBO_CACHE` configuration is the Check command and the wrapper;
other references are tests/documentation. Package and shell scripts delegate
to the wrapper without assigning a mode. Arbitrary process environment is
honored by the wrapper; secrets injection precedes Check's explicit mode.
`turboChildEnv` supplies the existing self-hosted API/team defaults. Normal
Check pins `TURBO_CONCURRENCY=12`; local callers retain the CPU-based default
or their explicit override. The root Turbo `50%` default is superseded by
the wrapper's explicit `--concurrency` argument.

## Task keys, outputs, and side effects

Turbo keys include each task's resolved definition, inputs, external lockfile
dependencies, declared environment, and dependency hashes. Global inputs
include `tsconfig.base.json` and `mise.toml`. The wrapper disables framework
inference. Contract tests additionally hash OS, architecture and actual Bun
version through `turbo-platform-key.json`; portable tasks share results.

| Task family | Inputs beyond package files | Restored output |
| --- | --- | --- |
| `src` dependency barriers | Transitive `^src`, ts-reset; tests/docs excluded | None; hash barrier |
| Typecheck | Transitive source, ts-reset, package configs/tests | None; passing verdict, incremental state unnecessary |
| Lint | Typecheck; lint engines/rules, naming, package scope and bug registry | None; passing verdict |
| Unit/contract tests | Typecheck; property seeds/fidelity; contract platform key | None; passing verdict |
| Spec parts | Typecheck; package domain specs, harness runner, mode/DOM/fidelity/seeds | Only that part's `.cache/harness-report/part-k/**` |
| Model checks | Domain `.qnt`, bindings, verifier/conformance implementation and tool pins | `.cache/harness-report/models/**` |
| Builds | Transitive build source barriers, catalogs/configs/public assets, public env | `dist/**` |
| Offline shell | Build dependency plus verification scripts | None; passing verdict |
| Worker bundle/schema/structural gates | Their declared source/config/rule inputs and dependencies | None; temporary work is not consumed later |

Package `turbo.json` files extend spec/model inputs with their owned domains.
Per-part output buckets do not overlap. Build dependency barriers now include
translation `.po` files, not just previously compiled TypeScript.

Secrets, run IDs, CI context, temporary paths, and reporting credentials are
pass-through variables rather than hashed inputs. Property seeds and harness
modes affect verification and are hashed. PR/secret scan ranges affect those
specific verdicts and are hashed there. Public build metadata affects bundles
and is therefore hashed for builds. No current timestamp was added as a salt.

Non-cacheable work remains setup/install, persistent dev/preview/process
management, infrastructure applies, deploy/migrate/provider synchronization,
live API/health probes, and now the registry advisory audit. These have live
inputs or external effects. Report upload/reuse happens outside cached task
execution and verifies exact task hashes and per-run completion receipts.
Cached contract side effects are confined to disposable local fixtures.

## Measurements

Controlled samples used `1737189f733ee781e0cd5d7389411384b77ac8fd` on
`depot-ubuntu-24.04-16` (16 CPUs, about 64 GiB). Each allocation had an empty
local cache. Cold samples disabled reads but wrote results; shared remote
entries were never deleted. All 489 task hashes matched across the 12/16/20
samples. Cold versus warm changes cache access only, not hashed task inputs.

| Slots | Turbo tasks | Check step incl. reports | Job | Peak memory | Result |
| --- | --- | --- | --- | --- | --- |
| 12 | 249.602s | 259.7s | 274.175s | 45.5% | 489 executed, 0 hits, passed |
| 12 repeat | 248.972s | 259.8s | 274.681s | 44.1% | 489 executed, 0 hits, passed |
| 16 | 253.211s | 263.6s | 283.117s | 62.7% | 489 executed, 0 hits, passed |
| 20 | 256.930s | 268.6s | 283.190s | 63.7% | 489 executed, 0 hits, passed |
| Same-commit warm, 16 | Audit only | 11.1s | 22.319s | 3.6% | 488 hits, 1 executed, passed |
| One-package probe, 16 | 3.1s incl. drain | 14.7s | 25.620s | 3.5% | 479 hits, 10 executed, passed |

The 16-slot cold job includes a credential scan after Check; compare task and
Check-step durations for concurrency. CPU averages were 77–79%, peaks about
97% at every slot count. Choose 12 from measured successful wall times and
lower memory, not from peak CPU alone. These few samples do not establish a
universal optimum. A repeat at 16 failed the S3 isolation example described
above and is excluded from successful timing comparisons; the failure is
not evidence that 16 intrinsically causes incorrect tests.

Cold evidence: [12](https://depot.dev/orgs/mk7ncjwh4n/workflows/ks5m5wwmvb),
[12 repeat](https://depot.dev/orgs/mk7ncjwh4n/workflows/dw58tqb501),
[16](https://depot.dev/orgs/mk7ncjwh4n/workflows/thl7fn5f3b),
[20](https://depot.dev/orgs/mk7ncjwh4n/workflows/g4jctm0b3f).
Warm: [same commit](https://depot.dev/orgs/mk7ncjwh4n/workflows/b0wtx6mkn3).
Probe: [one-package change](https://depot.dev/orgs/mk7ncjwh4n/workflows/r66kt4xw2t).

The probe temporarily changed only `pkgs/room-adapter-durable-object/src/index.ts`
with a comment, then restored it. Automated before/after plans showed exactly
nine changed real-task hashes: that package's `tc/lint/test`, `@libs/room-app`
`tc/lint`, and `@apps/room-server` `tc/lint/test/check:worker-bundle`. Depot
executed precisely those nine plus the always-live advisory audit. Unrelated
package hashes stayed unchanged. A real Turbo fixture separately verifies
producer/consumer invalidation, unrelated-package hits, changed output env,
remote-only output restoration, and unchanged keys on token/run-ID rotation.

The first ordinary read/write run already reused 336 tasks. All checks passed,
but its diagnostic scan required at least 400 archives and rejected its
176-archive coverage. The later full cold scan checked all 488 cacheable
archives against 29 credential variables, including raw, URL-encoded, base64,
and SHA-256 forms, with zero matches. That diagnostic is not a permanent gate.
API runs no longer emit the dependency cache event/ref validation warnings.

After isolating all contract sidecars, commit
`eb1fff113d57dde50a14d87e78170ff5f5517105` passed another complete cold/warm
pair at 12 slots:

| Run | Turbo tasks | Check step | Job | Cache hits / executed |
| --- | --- | --- | --- | --- |
| [Cold](https://depot.dev/orgs/mk7ncjwh4n/workflows/383nbp9hcc) | 246.078s | 256.5s | 275.817s | 0 / 489 |
| [Same-commit warm](https://depot.dev/orgs/mk7ncjwh4n/workflows/vh9dp69wv1) | Advisory audit only | 12.5s | 24.198s | 488 / 1 |

Both passed. Cold peak memory was 38.5%; its 488 archives had zero matches
against 40 environment variables selected for credential/config scanning,
including database URLs and common encodings. No API ref-validation warning
appeared. Global file/lock inputs matched between summaries; run-specific
pass-through metadata differed as expected, and the warm audit task's hash
matched the cold summary. The later root `package.json` build-input guard
adds invalidation for changes to the catalog compilation command; it changes
cache keys without changing task output or coverage.

## Critical path and retained coverage

At 12 slots the slowest cold tasks were billing part 2 (140.72s), billing
part 1 (119.63s), friends model verification (114.24s), billing part 0
(113.29s), and friends spec parts (103.62–107.16s). At 16, billing part 2
was 150.35s and chess part 2 was 136.13s; at 20 they were 165.79s and
141.41s. Caching removes these from an unchanged commit's critical path.

Existing spec runners already slice features/models, use `--parallel` and
`--no-isolate`, and reuse compiled/preloaded modules within each Bun process.
Many outer tasks each carry up to 16 inner test workers, plus Apalache JVMs.
The model runner intentionally serializes models within a package; different
packages still run concurrently. Each verification starts an isolated JVM.
Postgres harness seeds already use composition fingerprints and cloning.
No test isolation, search bound, sample count, timeout or coverage was reduced.

Cold trace aggregation found 52,676 billing queries, 170,206 chess queries,
and 115,172 friends queries; summed query spans were about 58s/127s/115s.
DB-open spans summed to only 1.2s/3.1s/2.8s. HTTP/sync spans are nested and
overlap, so their sums are not wall-clock attribution. This supports focusing
on cache reuse and contention before another database-startup refactor;
compilation/startup was not separately instrumented.

The six alleged zero-test parts actually executed these tests in the supplied
slow-run evidence: db-indexes 224, feedback 42, matchmaking-harness 82,
auth-harness 100, room-harness 100, sync-engine 185 (733 total). The zero
count was captured report timelines, now labeled accurately. No existing
part was removed. A truly empty configured part now fails instead of
publishing a passing completion; remove its task or repair its scope.

## Changed files

Relative to the supplied slow-run commit:

- `.depot/actions/setup/action.yml`
- `.depot/workflows/check.yml`
- `README.md`
- `turbo.json`
- `libs/harness/scripts/report-task-publish.ts`
- `libs/harness/scripts/report-task-publish.test.ts`
- `libs/harness/scripts/test-spec.ts`
- `libs/harness/scripts/test-spec-empty.test.ts`
- `libs/tools/docs/CI_CACHE_AUDIT.md`
- `libs/tools/goal/known-bugs.json`
- `libs/tools/scripts/ci-audit.ts`
- `libs/tools/scripts/turbo-ci-run.ts`
- `libs/tools/scripts/turbo-ci-run.test.ts`
- `libs/tools/scripts/turbo-preflight.ts`
- `libs/tools/scripts/turbo-preflight.test.ts`
- `libs/tools/scripts/turbo-deploy-graph.test.ts`
- `libs/tools/scripts/turbo-cache-integration.test.ts`
- `libs/tools/scripts/workflow-cache.test.ts`
- `pkgs/object-store-s3/src/object-store.s3.contract.test.ts`
- `pkgs/sql-client-postgres/src/postgres.contract.test.ts`
- `pkgs/db-indexes-postgres/tests/postgres.contract.test.ts`
- `pkgs/pubsub-emqx/tests/emqx.contract.test.ts`

## Validation boundaries

All validation is automated. Local tests prove parser/fixture behavior;
Depot provides Linux timing, actual API-trigger behavior and shared-cache
evidence. Credential scanning is bounded to the known environment values
and checked encodings, not proof against every possible secret derivation.
External S3/R2, Postgres and broker integration is intentionally outside
cached Check contracts; deployment/Health remains live and non-cacheable.
No deployment, dependency upgrade, infrastructure change, or merge was made.
