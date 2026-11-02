# CI stage policy

The blocking selection is `libs/tools-harness-ts/scripts/ci-stage.ts`. The complete
catalog stays in `MAIN_VERIFY_TASKS`; unclassified additions therefore run nightly.
Local `bun verify` retains that complete catalog. Depth, budgets and report retention
remain in `verify-profile.ts`, independently of selection. No tests were removed.

## Workflow audit

| Workflow and triggers | Responsibility and dependencies |
| --- | --- |
| Verify PR: PR opened/reopened/synchronized against main, manual, reusable call | `verify:start` builds a content-addressed plan and shared prerequisites; independent misses run in duration-balanced shards; `verify:end` aggregates every expected verdict. No path filter can strand the required status. New PR pushes cancel superseded runs. |
| Release: main push or manual dispatch | Reuse the safety gate on the exact checkout, repository policy, shared fleet, development, production, then release tag. A branch dispatch with `rehearsal=true` verifies and plans without applying. Production still requires main and its protected environment. Keep the newest pending run; never cancel an active migration/apply. |
| Verify Nightly: daily at 10:23 UTC or manual dispatch | Complete catalog at nightly depth plus random, browser, visual, coverage and performance groups. Groups run independently; visual waits only for its required corpus. Manual `all` gives a complete verdict; individual groups give diagnostic verdicts. |
| Health: hourly at minute 17 or manual dispatch | Live probes, critical journeys, infrastructure/repository drift and historical SLO checks. Releases nothing. Historical SLO debt cannot block a corrective release. |

`verify:end` remains the required status. The existing strict main ruleset, SHA-pinned
actions, fresh Ubuntu runners, read-only default token and protected production
environment remain. No workflow, runner service or dependency was added.

## Blocking check classification

PR and release use the same safety selection so a merge commit cannot introduce
unchecked changes. Selection is cheap; successful tasks execute only on cache misses.
The release gate does not run the full nightly catalog as a hidden prerequisite.

| Check | Why it cannot reasonably wait |
| --- | --- |
| Package `tc`, `lint`, root lint, `ci:syncpack` | Compilation, structural safety rules (including access boundaries), task-runner integrity and workspace dependency consistency. Turbo deduplicates lint's typecheck prerequisites. |
| `verify:actionlint`, `verify:workflow-security`, `verify:secrets` | Broken workflow syntax, unsafe automation permissions/triggers and committed credentials. Secret scanning remains tied to the immutable Git range. |
| `ci:audit` | Current dependency advisories block PRs. Release reports fresh registry changes without blocking an already reviewed lockfile; nightly enforces them again. Existing Dependabot alerts/security updates remain. |
| Permissions library/shared/harness and auth provider/root harness unit tests | Access-control and authentication failures can expose data immediately. These run the same assertions as nightly, not alternate implementations. |
| Migration and schema-engine unit tests; `verify:schema-evolution` | Destructive schema evolution cannot wait for nightly. The baseline is the immutable PR base or pre-push SHA, not a moving main ref that might already equal HEAD. A manual run compares the selected commit's parent. |
| Product/auth relay Worker bundle checks; rendered Worker; offline shell | The release executables and boot assets must exist and satisfy their runtime contracts. Their build prerequisites remain blocking and cached. |
| Synthetic population foundation; repository policy | Prevent unsafe infrastructure isolation, resource hosting and repository-protection changes. |
| Conditional PR fleet/foundation plans | Changed infrastructure needs provider validation against actual state. The existing read-only role and foundation opt-in remain. |

Release additionally retains foundation-before-migration ordering, stateful-resource
plan policy, runtime configuration and secret validation, durable room namespace
preservation, billing reconciliation and post-deployment live health/journeys. These
check real external systems and cannot be replaced by cached unit results. Development
must succeed before production; a tag is published only after production health passes.

## Nightly check classification

Everything below remains in its existing owning package and production-relevant harness:

- General `test` suites and split `test:unit:*` suites; security tests above also run
  at nightly depth through the same catalog.
- All `test:contract` variants, render contracts, all numbered `test:spec:*` parts,
  Quint `verify:models` parts and `verify:board-contract`.
- Every split release journey, Storybook checks and remote corpus checks.
- `ci:i18n`, `ci:agent-commands`, `ci:workspace-lifecycle`, `ci:cache-hygiene`,
  `ci:package-names`, `ci:goals`, `ci:specs`, `ci:statecharts`, `ci:conformance`,
  `ci:spec-ownership`, branding and synthetic rebranding checks.
- Fresh-seed property runs, deterministic fuzz, database-index mutation testing,
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
track them; pin regressions, and promote critical safeguards into blocking selection.
Automation exposes persistent failures; it cannot guarantee human triage.

## Reuse, installation and deployment artifacts

Bun uses the frozen lockfile and a download cache, not an archived node_modules tree.
Generation artifacts are separate from verification verdicts. Installation happens
before secrets injection. Blocking shards/fan-in install only their pinned required
tools; JVM/model-checker and developer tool installation stays out of that path.
Nightly keeps the complete toolchain. The planner retains the pinned browser fingerprint
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

No unique verification was judged redundant enough to delete. The removed redundancy
is comprehensive execution on every PR and again on release. Named security tests run
once within each selected graph; nightly's generic `test` includes those same suites.
Existing cached successes, shared build prerequisites and identical dependency tasks
remain deduplicated by Turbo. Superseded pending releases no longer consume deployment
work. Full nightly coverage and hourly production monitoring remain unchanged.

Dry-run dependency closures contain **740 executable blocking tasks versus 1,536** in
the former full gate (796 fewer, about 52%). The checked-in task-cost estimator models
**2,100 versus 20,788 task-seconds**, approximately **90% less cold gate task work**.
These include 3 and 47 fallback estimates respectively, and family estimates where no
exact measurement exists. They are not new hosted benchmarks or a billing forecast.

At the existing roughly three-minute shard target and 64-shard cap, an illustrative
cold verification is approximately **4–6 minutes instead of 7–10 minutes**, including
ordinary setup/fan-in but excluding queue delays. Both PR and release verification
benefit; warm runs may improve little because they already restore cached results.
Total release latency falls only by the saved verification time: infrastructure,
environment builds and live checks remain. Nightly compute is unchanged. Daily compute
savings depend on PR volume and cache misses; do not multiply the cold 90% estimate by
all CI spending. `bun ci:stats` now reports the blocking/nightly split instead of
incorrectly assigning the entire catalog to PRs. Validate projections with hosted
per-job timing and cache-hit data after rollout.

Accepted risk: ordinary functional, integration, visual and performance failures may
reach main or production before nightly discovers them. Blocking access-control,
secrets, dependency, schema and deployability checks plus live production probes limit
critical exposure. Complete nightly verification, assigned triage and pinned regressions
provide the feedback loop; nightly intentionally does not become a release gate.

## Authoritative references

- [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) defines permissions, required-check triggers and concurrency. Default pending-run replacement is used only where stale work may safely be superseded.
- [GitHub deployment controls](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments) supports serialized deployments and environment protection.
- [GitHub dependency caching](https://docs.github.com/en/actions/concepts/workflows-and-actions/dependency-caching) distinguishes reusable dependencies from outputs and describes cache access scope.
- [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations) explains artifact provenance. This pipeline retains its existing build-and-deploy job boundary rather than introducing unverified cross-run artifact promotion.
- [Turborepo caching](https://turborepo.dev/docs/crafting-your-repository/caching) requires correct inputs and outputs for deterministic reuse.
- [Google SRE release engineering](https://sre.google/sre-book/release-engineering/) and [release safety](https://sre.google/workbook/canarying-releases/) support automated reproducibility, staged rollout, observable health and recovery. The stage selection above is an engineering judgment for this codebase, not a universal minimum-check checklist.
