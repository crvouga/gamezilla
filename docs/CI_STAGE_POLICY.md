# CI stage policy

Every stage — pull request, Release, nightly and local `bun verify` — runs the whole
gate catalog, `MAIN_VERIFY_TASKS` (`libs/tools-harness-ts/scripts/ci-stage.ts`). A
change is held to every gate task nightly would find red; only the tasks whose inputs
it changed execute, and every other verdict replays from the remote cache. Depth,
budgets and report retention remain in `verify-profile.ts`, independently of
selection; nightly's deeper groups (random, browser, visual, coverage, performance)
sit outside the gate.

A narrower PR/Release selection (2026-11-01 to 2026-11-09) let PR #287 (a brand slug
`verify:brand-policy` rejects), commit e2cc4c093 (a stale server contract manifest),
PR #288 (`ci:specs`) and others merge green while nightly's gate went red on about
thirteen tasks (known bug `pr-gate-narrower-than-nightly`).

## Workflow audit

| Workflow and triggers | Responsibility and dependencies |
| --- | --- |
| Verify PR: PR opened/reopened/synchronized against main, manual, reusable call | `verify:start` builds a content-addressed plan and shared prerequisites; independent misses run in duration-balanced shards; `verify:end` aggregates every expected verdict. No path filter can strand the required status. New PR pushes cancel superseded runs. |
| Release: main push or manual dispatch | Run the whole gate, critical production-build journeys included, on the exact checkout, repository policy, shared fleet, development, production, then release tag. A branch dispatch with `rehearsal=true` verifies and plans without applying. Production still requires main and its protected environment. Keep the newest pending run; never cancel an active migration/apply. |
| Verify Nightly: daily at 10:23 UTC or manual dispatch | Complete catalog at nightly depth plus random, browser, visual, coverage and performance groups. Groups run independently; visual waits only for its required corpus. Manual `all` gives a complete verdict; individual groups give diagnostic verdicts. |
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

PR and Release run the whole gate catalog at release depth: every package's `tc`,
`lint`, `test`, contract models, spec parts and Quint models, the repository
consistency checks, branding checks, Storybook checks, and all three
`@apps/product-ts#test:release-journeys:<k>` partitions. Release rechecks the exact
selected commit and reuses only identical successful task hashes. Manual Verify PR
dispatches use the same selection. A regression test (`ci-stage.test.ts`) requires PR,
Release and nightly selections to stay equal as the catalog changes. Nightly runs the
same catalog at its deeper profile.

Selection is cheap; successful tasks execute only on cache misses, so a change pays for
the tasks its inputs reach. Gate shards install the complete pinned toolchain (the setup
action's default), the same one nightly's gate shards use, so no selected task lacks
its JVM, model checker or scanner.

Among the gate, these checks are why the gate must block rather than wait:

| Check | Why it cannot reasonably wait |
| --- | --- |
| Package `tc`, `lint`, root lint, `ci:syncpack` | Compilation, structural safety rules (including access boundaries), task-runner integrity and workspace dependency consistency. Turbo deduplicates lint's typecheck prerequisites. |
| `ci:i18n`, `ci:specs`, `ci:statecharts` | Repository consistency: the committed Lingui catalog matches the source copy, every spec stays in its context's language, and every contract has an owning chart. Only a pull request can break them, so only a pull request can be held to them; left to nightly they merged green and kept every later night red. |
| `verify:actionlint`, `verify:workflow-security`, `verify:secrets` | Broken workflow syntax, unsafe automation permissions/triggers and committed credentials. Secret scanning remains tied to the immutable Git range. |
| `ci:audit` | Current dependency advisories block PRs. Release reports fresh registry changes without blocking an already reviewed lockfile; nightly enforces them again. Existing Dependabot alerts/security updates remain. |
| Permissions library/shared/harness and auth provider/root harness unit tests | Access-control and authentication failures can expose data immediately. These run the same assertions as nightly, not alternate implementations. |
| Migration and schema-engine unit tests; `verify:schema-evolution` | Destructive schema evolution cannot wait for nightly. The baseline is the immutable PR base or pre-push SHA, not a moving main ref that might already equal HEAD. A manual run compares the selected commit's parent. |
| Product/auth relay Worker bundle checks; rendered Worker; offline shell | The release executables and boot assets must exist and satisfy their runtime contracts. Their build prerequisites remain blocking and cached. |
| Production-build journey partitions | Catch browser, auth, sync and game integration failures before merge using the same production bundle and stack as Release verification. |
| Synthetic population foundation; repository policy | Prevent unsafe infrastructure isolation, resource hosting and repository-protection changes. |
| Conditional PR fleet/foundation plans | Changed infrastructure needs provider validation against actual state. The existing read-only role and foundation opt-in remain. |

Release additionally retains foundation-before-migration ordering, stateful-resource
plan policy, runtime configuration and secret validation, durable room namespace
preservation, billing reconciliation and post-deployment live health/journeys. These
check real external systems and cannot be replaced by cached unit results. Development
must succeed before production; a tag is published only after production health passes.

## Nightly-only groups

Nightly runs the whole gate above at deeper budgets, and adds groups outside the gate:
fresh-seed property runs, deterministic fuzz, database-index mutation testing,
real-browser stack integration, UI quality, Storybook browser/MCP verification,
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
track them; pin regressions in their gate suites, which every pull request then runs.
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

No verification is deleted. PR, Release and nightly run one gate; existing cached
successes, shared build prerequisites and identical dependency tasks remain
deduplicated by Turbo, so a change executes only what its inputs reach. A change to a
hub package reruns its dependents' gate tasks, sized into up to 64 shards. Superseded
pending releases no longer consume deployment work. Hourly production monitoring
remains unchanged.

Accepted risk: merge interactions, live environment failures and findings only the
nightly-only groups make may still reach main; nightly intentionally does not become a
release gate. Assigned triage and pinned gate regressions close that loop.

## Authoritative references

- [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) defines permissions, required-check triggers and concurrency. Default pending-run replacement is used only where stale work may safely be superseded.
- [GitHub deployment controls](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments) supports serialized deployments and environment protection.
- [GitHub dependency caching](https://docs.github.com/en/actions/concepts/workflows-and-actions/dependency-caching) distinguishes reusable dependencies from outputs and describes cache access scope.
- [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations) explains artifact provenance. This pipeline retains its existing build-and-deploy job boundary rather than introducing unverified cross-run artifact promotion.
- [Turborepo caching](https://turborepo.dev/docs/crafting-your-repository/caching) requires correct inputs and outputs for deterministic reuse.
- [Google SRE release engineering](https://sre.google/sre-book/release-engineering/) and [release safety](https://sre.google/workbook/canarying-releases/) support automated reproducibility, staged rollout, observable health and recovery. The stage selection above is an engineering judgment for this codebase, not a universal minimum-check checklist.
