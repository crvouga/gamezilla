# CI stage policy

A pull request runs the four tasks that cannot wait for Release (`PR_TASKS` in
`libs/tools-harness-ts/scripts/ci-stage.ts`). Release, nightly, a manual Verify PR
dispatch and local `bun verify` run the whole gate catalog, `MAIN_VERIFY_TASKS`; only
the tasks whose inputs changed execute, and every other verdict replays from the
remote cache. Depth, budgets and report retention remain in `verify-profile.ts`,
independently of selection; nightly's deeper groups (random, browser, visual,
coverage, performance) sit outside the gate.

| Pull-request task | Why it cannot wait for Release |
| --- | --- |
| `tc`, `lint` | `main` must compile and keep its boundaries, or every Release failure after it is noise. |
| `verify:secrets` | A credential that reaches `main` has leaked. |
| `verify:actionlint` | A workflow that does not parse cannot run Release, so nothing would report it. |

Everything else is first run by Release, on the merged commit, before anything
deploys. A check that fails there blocks that release and every release behind it, and
keeps one open issue of its own (label `ci-failure`, title "Release check failing on
main: `<task>`") until a Release verifies it green
(`libs/tools-harness-ts/scripts/ci-check-issues.ts`). The issue is rewritten by every
red Release with the newest run, the run that first went red and the count of red runs
since; it is never duplicated and never closed by hand. A check whose shard crashed
has no verdict and is neither filed nor closed; the "Release is failing on main" issue
reports that run. More than twenty failing checks at once have one cause, so the rest
are named in that issue instead of filed one by one.

Accepted cost: a pull request that breaks a skipped check merges green and stops
releases until the fix merges. Between 2026-11-01 and 2026-11-09 a narrower PR
selection without these issues let about thirteen gate tasks stay red on main
unnoticed (known bug `pr-gate-narrower-than-nightly`); the per-check issues and the
blocked release are what make the same selection visible now. To prove a change
before merging, dispatch the whole gate on the branch: `gh workflow run verify-pr.yml
--ref <branch>`.

## Workflow audit

| Workflow and triggers | Responsibility and dependencies |
| --- | --- |
| Verify PR: PR opened/reopened/synchronized against main, manual, reusable call | On a PR, only `verify:end` allocates compute. It verifies the four PR tasks and their dependencies. For full-catalog runs, `verify:start` builds a content-addressed plan and shared prerequisites; independent misses run in duration-balanced shards; `verify:end` aggregates every expected verdict. A pull request plans `PR_TASKS`; a manual dispatch or a reusable call plans the whole catalog. No path filter can strand the required status. New PR pushes cancel superseded runs. |
| Release: main push or manual dispatch | Run the whole gate, critical production-build journeys included, on the exact checkout, repository policy, shared fleet, development, production, then release tag. A branch dispatch with `rehearsal=true` verifies and plans without applying. Production still requires main and its protected environment. Keep the newest pending run; never cancel an active migration/apply. |
| Verify Nightly: daily at 10:23 UTC or manual dispatch | Complete catalog at nightly depth plus random, browser, visual, coverage and performance groups. Groups run independently. Manual `all` gives a complete verdict; individual groups give diagnostic verdicts. |
| Health: hourly at minute 17 or manual dispatch | Live probes, critical journeys, infrastructure/repository drift and historical SLO checks. Releases nothing. Historical SLO debt cannot block a corrective release. |

`verify:end` remains the required status. The main ruleset (verified PRs, not required to be up to date), SHA-pinned
actions, fresh Ubuntu runners, read-only default token and protected production
environment remain. No workflow, runner service or dependency was added.

## Blocking check classification

A releasable commit produces valid deployable bundles, boots with its offline shell,
preserves authentication, authorization and stored data, and passes the critical user
journeys against its production client and production-like API/database stack. The
release must also pass environment configuration, infrastructure safety and live
post-deployment probes before it is tagged. This is a bounded automated release bar;
it does not promise that every feature, visual state or performance case is correct.

Release runs the whole gate catalog at release depth: every package's `tc`,
`lint`, `test`, contract models, spec parts and Quint models, the repository
consistency checks, branding checks, Storybook checks, and all three
`@apps/product-ts#test:release-journeys:<k>` partitions. Release checks the exact
selected commit and reuses only identical successful task hashes. Manual Verify PR
dispatches use the same selection. A regression test (`ci-stage.test.ts`) requires
Release and nightly selections to stay equal as the catalog changes, and the
pull-request selection to stay `PR_TASKS`. Nightly runs the same catalog at its deeper
profile.

Selection is cheap; successful tasks execute only on cache misses, so a change pays for
the tasks its inputs reach. Gate shards install the complete pinned toolchain (the setup
action's default), the same one nightly's gate shards use, so no selected task lacks
its JVM, model checker or scanner.

Among the gate, these checks are why Release must block a deploy rather than wait for nightly:

| Check | Why it cannot reasonably wait |
| --- | --- |
| Package `tc`, `lint`, root lint, `ci:syncpack` | Compilation, structural safety rules (including access boundaries), task-runner integrity and workspace dependency consistency. Turbo deduplicates lint's typecheck prerequisites. |
| `ci:i18n`, `ci:specs` | Repository consistency: the committed Lingui catalog matches the source copy, and every spec stays in its context's language. Left to nightly they merged green and kept every later night red; Release now stops on them and files the issue. |
| `verify:actionlint`, `verify:workflow-security`, `verify:secrets` | Broken workflow syntax, unsafe automation permissions/triggers and committed credentials. Secret scanning remains tied to the immutable Git range. |
| `ci:audit` | Release reports current dependency advisories without blocking a deploy on a registry that moved; nightly enforces them. Existing Dependabot alerts/security updates remain. |
| Permissions library/shared/harness and auth provider/root harness unit tests | Access-control and authentication failures can expose data immediately. These run the same assertions as nightly, not alternate implementations. |
| Migration and schema-engine unit tests; `verify:schema-evolution` | Destructive schema evolution cannot wait for nightly. The baseline is the immutable PR base or pre-push SHA, not a moving main ref that might already equal HEAD. A manual run compares the selected commit's parent. |
| Product/auth relay Worker bundle checks; rendered Worker; offline shell | The release executables and boot assets must exist and satisfy their runtime contracts. Their build prerequisites remain blocking and cached. |
| Production-build journey partitions | Catch browser, auth, sync and game integration failures before deployment using the production bundle and stack. |
| Synthetic population foundation; repository policy | Prevent unsafe infrastructure isolation, resource hosting and repository-protection changes. |
| Fleet/foundation plans | Changed infrastructure needs provider validation against actual state. A Release rehearsal on the branch (`rehearsal=true`) plans both; pull requests no longer do. |

Release additionally retains foundation-before-migration ordering, stateful-resource
plan policy, runtime configuration and secret validation, durable room namespace
preservation, billing reconciliation and post-deployment live health/journeys. These
check real external systems and cannot be replaced by cached unit results. Development
must succeed before production; a tag is published only after production health passes.

## Nightly-only groups

Nightly runs the whole gate above at deeper budgets, and adds groups outside the gate:
fresh-seed property runs, deterministic fuzz, database-index mutation testing,
real-browser stack integration, Storybook browser/MCP verification,
coverage, room/sync/Pong benchmarks and SQL performance checks.

Nightly keeps all drawn Quint traces, five times the pinned property budget, reports,
seeds and replay instructions. The existing Linux/native/POSIX scope is unchanged;
this change does not claim to add Apple or POSIX suites that CI never ran.

The ending job fails on any missing or unsuccessful selected group. A failing full
main run creates or updates one issue assigned to `CI_TRIAGE_OWNER` (repository owner
by default), with commit, run, artifacts and reproduction commands. Security/data-loss
findings are P1 for immediate containment; other regressions are P2 for next-working-day
triage. Every later red night updates the still-open issue; only a complete green main
run closes it. Failed issue API calls now fail visibly instead of being ignored.
Targeted diagnostics cannot close the issue. Owners must fix findings or explicitly
track them; pin regressions in their gate suites, which every Release then runs.
Automation exposes persistent failures; it cannot guarantee human triage.

## Reuse, installation and deployment artifacts

Bun uses the frozen lockfile and a download cache, not an archived node_modules tree.
Generation artifacts are separate from verification verdicts. Installation happens
before secrets injection. Gate shards and the fan-in install the complete pinned
toolchain at every profile, since they run the same catalog. The planner retains the pinned browser fingerprint
so cached tests use the same execution identity as their workers.

Turbo hashes source, dependency edges, declared environment and outputs. The planner
restores successful immutable results; unchanged work is not re-executed merely because
a PR became a main commit. Plan/evidence transfers remain scoped to the run; no artifact
is selected by a mutable branch name or a "latest successful" verdict. Reports are
nightly-owned; short-lived PR transfer artifacts are deleted after aggregation.

The production client embeds its environment origin and commit identity. A generic PR
bundle is therefore not the production artifact. Each environment builds its final
bundle, validates its environment and generated distribution, then deploys that output
without an intervening rebuild. Development and production builds are intentionally
separate configurations; claiming one interchangeable artifact would be incorrect.
The existing Turbo build outputs remain reusable only for identical inputs. No new
cross-run privileged artifact download or cache trust mechanism is introduced.

PR code receives no production credentials. Fork PRs still fail closed at credentialed
setup; automatic fork verification without secrets is an existing limitation, not a
new privileged trigger. The existing remote-cache credential is trusted repository
infrastructure, shared with authorized contributors; this change does not extend its
trust to fork artifacts. Keep its scope restricted and rotate it through existing tools.

Recovery remains a reviewed revert/fix PR through the same main deployment path. Do not
reverse database migrations or delete state to roll back code. Post-deployment failures
remain visible and prevent release tagging; a failed probe after deployment is detection,
not a claim that the preceding deployment was atomically undone.

## Redundancy and expected improvement

No verification is deleted; a pull request defers all but four tasks to Release.
Release and nightly run one gate; existing cached successes, shared build prerequisites and identical dependency tasks remain
deduplicated by Turbo, so a change executes only what its inputs reach. A change to a
hub package reruns its dependents' gate tasks, sized into up to 64 shards. Superseded
pending releases no longer consume deployment work. Hourly production monitoring
remains unchanged.

Accepted risk: a failure in any check a pull request skips, merge interactions, live
environment failures and findings only the nightly-only groups make may reach main; nightly intentionally does not become a
release gate. Assigned triage and pinned gate regressions close that loop.

## Authoritative references

- [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) defines permissions, required-check triggers and concurrency. Default pending-run replacement is used only where stale work may safely be superseded.
- [GitHub deployment controls](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments) supports serialized deployments and environment protection.
- [GitHub dependency caching](https://docs.github.com/en/actions/concepts/workflows-and-actions/dependency-caching) distinguishes reusable dependencies from outputs and describes cache access scope.
- [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations) explains artifact provenance. This pipeline retains its existing build-and-deploy job boundary rather than introducing unverified cross-run artifact promotion.
- [Turborepo caching](https://turborepo.dev/docs/crafting-your-repository/caching) requires correct inputs and outputs for deterministic reuse.
- [Google SRE release engineering](https://sre.google/sre-book/release-engineering/) and [release safety](https://sre.google/workbook/canarying-releases/) support automated reproducibility, staged rollout, observable health and recovery. The stage selection above is an engineering judgment for this codebase, not a universal minimum-check checklist.

## Hosted PR throughput diagnostic

Dispatch Verify Nightly with `group=pr-load` and a JSON array of full commit SHAs in
`pr-load-revisions`. Each revision must belong to the history of main. Use the batch command to verify the number of distinct revisions before dispatch.
The report checks the number of GitHub jobs, accounts for failures, and writes
the observed timing and utilization percentiles under `.cache/pr-load-reports/`.

```sh
python3 libs/tools-harness-ts/scripts/pr-load-report.py dispatch 10 --base origin/main
python3 libs/tools-harness-ts/scripts/pr-load-report.py report RUN_ID 10
```

For a load sweep, submit separate batches of 1, 10, 25, 50 and 100 distinct revisions.
Wait for each batch to finish before dispatching the next. Repeating the diagnostic
on the same ref supersedes the previous run. Record the run IDs and exact revisions.

GitHub's Jobs API supplies job creation, start, setup and completion timestamps.
Each worker retains one small `pr-load-<sha>/metrics.json` artifact for three days.
It records the gate exit code, plan and execution durations, cache counts, process-tree
CPU seconds, CPU utilization relative to available cores, peak process RSS and
the runner's peak used-memory fraction sampled once a second. A missing timing
phase means the driver did not report it. Count failed and missing samples in the
batch outcome. Throughput is successful jobs divided by time from dispatch to
last worker completion. Standard hosted runners on this public repository incur
zero GitHub Actions compute charges. External service and storage charges are separate.

The diagnostic uses the source tree and pinned dependencies of each merged revision.
A shared remote cache can already contain verdicts from its original PR and Release.
Each secret scan covers the sampled commit. Production PRs scan their actual commit
range. Shipping latency requires a successful
production Release and cannot be inferred from the diagnostic.
