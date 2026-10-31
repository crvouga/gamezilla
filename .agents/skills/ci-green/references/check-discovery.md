# Check discovery

How `discover-checks` turns each CI system's configuration into local checks,
what it cannot know, and how to finish the job by hand.

## Contents

- [The manifest](#the-manifest)
- [Which checks matter](#which-checks-matter)
- [GitHub Actions](#github-actions)
- [GitLab CI](#gitlab-ci)
- [CircleCI](#circleci)
- [Buildkite](#buildkite)
- [Azure Pipelines](#azure-pipelines)
- [Jenkins](#jenkins)
- [Hooks: pre-commit, lefthook, husky](#hooks-pre-commit-lefthook-husky)
- [Task runners](#task-runners)
- [Toolchains](#toolchains)
- [Cannot run locally](#cannot-run-locally)
- [Overrides](#overrides)
- [Monolithic gates](#monolithic-gates)

## The manifest

`.ci-green/checks.json` (rewritten by every discovery run):

| Field | Meaning |
| --- | --- |
| `repo` | root, branch, HEAD, base ref, merge-base, changed files (diff + untracked) |
| `toolchain` | version manager, chosen pins, every version file found, conflicts |
| `required` | required status contexts and where they came from, or why unknown |
| `sources` / `unparsed` | config files read, and files that failed to parse (with the error) |
| `hints` | local gate scripts the repo defines, doc lines naming a local gate |
| `checks[]` | one entry per CI job (per matrix leg) and per hook framework |

Each check:

| Field | Meaning |
| --- | --- |
| `id` | stable id: `<system>.<file>.<job>[.<matrix values>]` |
| `name` | the status name CI reports (GitHub: job name, `caller / callee` for reusable workflows, `name (a, b)` for matrix legs) |
| `in_pr`, `trigger` | whether it runs on a pull request into the base branch, and why (not) |
| `path_filters`, `triggered_by_diff` | path filters, and whether this diff triggers them (`null` = no filter) |
| `required` | `true` / `false`, or `null` when GitHub enforces nothing or was not asked |
| `phase`, `weight`, `weight_source` | ordering class and cost class, estimated or observed by a previous run |
| `needs` | ids that must pass first |
| `os`, `runs_on`, `container` | where CI runs it |
| `services` | containers it needs (image, ports, env) |
| `toolchain` | `{tool: {version, source, verify, conflicts}}` |
| `env` | merged workflow and job environment after expression evaluation |
| `steps[]` | `name`, `run`, `cwd`, `shell`, `env`, `local` (`run`, `skip`, `ci-only`), `kind` (`setup`, `system-setup`, `toolchain`), `note`, `resolves_to` |
| `local` | `runnable` (`yes`/`partial`/`no`), `blocked_by`, `limited_by` |
| `secrets`, `vars`, `unresolved` | secret names, repository variables (assumed unset) and expressions only CI can evaluate |

Step `local` values: `run` is executed by `run-check`; `skip` is normally omitted by the local helper (checkout, caches, artifact upload, toolchain setup, system
package installs); `ci-only` affects the result in CI but cannot or must not
run here (secrets, OIDC, publishing, deploys, GitHub API calls). A `ci-only`
step makes the check `partial`. Run selected relevant steps with local stand-ins
where available; only the actual CI result proves the omitted steps work.

## Which checks matter

- **Pull-request checks** are those whose triggers include a pull request
  into the base branch (`pull_request`, `pull_request_target`,
  `merge_group`; GitLab merge-request pipelines; Azure `pr:`; CircleCI and
  Buildkite run on every push unless a branch filter says otherwise).
  Pushes to `main`, schedules and
  manual dispatches are listed under "not run on pull requests" and are out
  of scope unless the user asks.
- **Hosted results select the repair work.** Discovery reads configuration,
  not current run status. Inspect the provider's current checks/logs separately;
  `--network` annotates branch protection and rulesets only.
- **Path filters and the diff** help identify relevant local checks. Do not
  force filtered-out checks to run locally without a concrete reason. Confirm
  required checks are present and successful before claiming the PR green.

## GitHub Actions

Files: `.github/workflows/*.yml|yaml`. Translation:

- `on:` decides `in_pr`; `branches` / `branches-ignore` are matched against
  the base branch.
- `env` at workflow, job and step level merge in that order.
- `${{ }}` expressions are evaluated for a pull-request event: `github.*`
  from git (base ref, head SHA, repository from `origin`), `matrix.*`,
  `inputs.*` (reusable workflow and composite action inputs with defaults),
  `env.*`, and the functions `contains`, `startsWith`, `endsWith`,
  `format`, `join`, `toJSON`, `fromJSON`, `hashFiles`, `success()`,
  `always()` (true) and `failure()` / `cancelled()` (false). `secrets.X`
  resolves only when `X` is set in your environment; `vars.X` is assumed
  unset and listed. Anything else (`needs.*.outputs`, `steps.*.outputs`)
  stays unresolved and is reported.
- `if:` false for a pull request: the step or job is skipped, exactly as CI
  would skip it.
- `strategy.matrix`: the cartesian product, then `exclude`, then `include`
  (extends matching legs, otherwise adds a leg). A matrix computed at run
  time (`fromJSON(needs.x.outputs.y)`) becomes one check marked dynamic;
  find the real legs in the job that computes them.
- `jobs.<id>.uses: ./.github/workflows/x.yml` expands the callee's jobs as
  `caller / callee` with `with:` as inputs. Remote reusable workflows
  (`org/repo/...@ref`) cannot be read and make the check `no`.
- `uses: ./path` composite actions are inlined step by step with their
  inputs. JavaScript and Docker actions are `ci-only`.
- Setup actions (`actions/setup-node`, `setup-python`, `setup-go`,
  `setup-java`, `setup-dotnet`, `ruby/setup-ruby`, `oven-sh/setup-bun`,
  `pnpm/action-setup`, `dtolnay/rust-toolchain`, ...) become toolchain pins,
  including `*-version-file` inputs. `jdx/mise-action`, `asdf-vm/actions`
  mean "the repo's version manager installs every pinned tool".
- A few wrapper actions translate to their CLI: golangci-lint, pre-commit,
  actionlint, shellcheck, ruff, black, gitleaks, typos, docker build.
- `services:` become containers started once by `run-check` (image, ports,
  env). `container:` is recorded: CI runs inside that image, so a host
  toolchain can differ; the image tag becomes a pin when recognisable.
- `$GITHUB_ENV`, `$GITHUB_PATH`, `$GITHUB_OUTPUT` and
  `$GITHUB_STEP_SUMMARY` work locally: `run-check` gives each run temporary
  files and applies `GITHUB_ENV` / `GITHUB_PATH` between steps.
- `run-check` sets `CI=true` (many tools change behaviour on it: Jest stops
  writing new snapshots, installers stop prompting) but not
  `GITHUB_ACTIONS`, so tools do not try to talk to the Actions runtime.

## GitLab CI

File: `.gitlab-ci.yml`, plus `include: local:` files (merged). Remote,
project, template and component includes are noted and not read: jobs they
define are missing, so say so.

- Jobs are top-level keys that are not reserved words and do not start with
  `.`. `extends` is deep-merged (lists replace), `!reference [job, key]` is
  resolved, YAML anchors and `<<` merges are honoured.
- `default:` and top-level `image`, `services`, `before_script`,
  `after_script` apply to every job that does not set its own.
- The local command is `before_script` + `script`; `after_script` runs even
  on failure and never fails the job.
- `variables` (global then job; `{value: ...}` forms included);
  `parallel: matrix` expands to one check per combination.
- `image:` is the toolchain (`node:20`, `python:3.12`, `golang:1.22`, ...).
  `services:` become containers, named by `alias` or image.
- `needs:` gives dependencies; without it, a job depends on every job in
  earlier `stages`.
- In a merge-request pipeline: `rules:` are evaluated in order (an
  `if` mentioning `merge_request_event`, or one that does not mention
  `CI_PIPELINE_SOURCE`, matches; `when: never` excludes; `changes:` become
  path filters); `only`/`except` refs (`merge_requests`, `branches`) are
  honoured; `when: manual` jobs are not run; `allow_failure: true` is noted.
- `trigger:` jobs start other pipelines and are not reproduced.

## CircleCI

File: `.circleci/config.yml`.

- `workflows.<wf>.jobs` decides what runs; `requires` gives dependencies;
  `filters.branches` is checked against the current branch; `type:
  approval` is a manual gate; `context:` means secrets from that context.
- `executors` are resolved; the first `docker` image is the primary
  container and toolchain, the rest are services.
- Steps: `checkout`, caches, workspaces, artifacts and test results are
  skipped; `run` (string or `{command, name, working_directory,
  environment, background}`) runs; `when`/`unless` blocks are flattened;
  reusable `commands` are inlined with `<< parameters.x >>` substituted
  (defaults, job parameters, matrix values, `<< pipeline.parameters.x >>`).
- Orb jobs and commands (`node/test`, `python/install-packages`) are not
  expanded: translate them by hand from the orb's source, or mark them
  `no`.
- `setup: true` dynamic configuration generates the real pipeline at run
  time; read the generator script.

## Buildkite

Files: `.buildkite/pipeline.yml|yaml|json`, `buildkite.yml`.

- `command` / `commands` run; `label` names the check; `key` and
  `depends_on` give dependencies; `wait` makes later steps depend on
  everything before it; `group` steps are flattened.
- `plugins`: `docker#v*` supplies the image (toolchain); `docker-compose#v*`
  runs inside a compose service (start the compose stack as the service);
  other plugins are noted.
- `block` / `input` steps are manual gates, `trigger` steps start other
  pipelines; `soft_fail` does not fail the build; `branches` and `if` are
  noted.
- `buildkite-agent pipeline upload` generates steps at run time: read the
  generator (often `.buildkite/pipeline.sh`) to see what it adds.

## Azure Pipelines

Files: `azure-pipelines.yml|yaml`, `.azure-pipelines.yml`,
`.azure-pipelines/*.yml`, `.azuredevops/*.yml`.

- Shapes: `stages → jobs → steps`, `jobs → steps`, or bare `steps`.
- `pr:` decides pull-request runs (`none` disables; `branches.include`
  checked against the base; `paths` become filters). Without `pr:`, Azure
  Repos needs a branch policy to run it; GitHub repos run it on every PR.
- `script` / `bash` run with bash, `pwsh` / `powershell` with `pwsh`;
  `workingDirectory`, `env`, `condition` are kept; `$(var)` macros are
  substituted from `variables` (list or map form) and matrix legs.
  `- group:` variable groups hold secrets.
- Tasks: `NodeTool` / `UseNode`, `UsePythonVersion`, `GoTool`,
  `JavaToolInstaller`, `UseDotNet`, `UseRubyVersion` become toolchain pins;
  `Npm` and `DotNetCoreCLI` translate to commands; publish, cache and
  artifact tasks are skipped; other tasks are `ci-only` and need a hand
  translation.
- Step `- template: x.yml` from the same repo is inlined with
  `${{ parameters.x }}` defaults; stage and job templates are noted.
- `pool.vmImage` gives the OS.

## Jenkins

File: `Jenkinsfile` (also `jenkins/Jenkinsfile`, `ci/Jenkinsfile`). Groovy
cannot be parsed reliably without Jenkins, so it is read heuristically and
the manifest says so:

- each innermost `stage('name') { ... }` is a check; `parallel` children are
  independent, sequential stages depend on the previous one;
- `sh '...'`, `sh "..."`, `sh '''...'''`, `sh(script: ...)` are the commands;
  `bat` / `powershell` mean Windows;
- `agent { docker { image '...' } }` / `docker.image('...')` give the
  toolchain;
- `when { branch 'main' }` without `changeRequest()` means not on PRs;
- `credentials('id')` means a secret.

Read the Jenkinsfile and check every stage against the manifest. Shared
libraries (`@Library`) hide steps: read them or mark the stage `partial`.

## Hooks: pre-commit, lefthook, husky

A hook framework is a CI check only when CI runs it: pre-commit.ci (a `ci:`
key in `.pre-commit-config.yaml`, status `pre-commit.ci - pr`) or a workflow
step that calls `pre-commit` / `lefthook`. Otherwise it is listed as a local
hook, not run on pull requests, and still worth running because it usually
mirrors CI's formatters and linters.

- pre-commit: `pre-commit run --all-files --show-diff-on-failure`. Formatter
  hooks rewrite files; the rewrite is part of the fix, so review it.
- lefthook: each `pre-commit` / `pre-push` command; `{staged_files}`,
  `{push_files}`, `{files}`, `{all_files}` are replaced by the changed files
  matching the command's `glob` (the step is skipped when none match).
- husky: `.husky/pre-commit` and `.husky/pre-push` run as scripts;
  `lint-staged` only sees staged files, so prefer the CI equivalent.

Never bypass a hook (`--no-verify`, `HUSKY=0`, `SKIP=`); fix what it reports.

## Task runners

When a step calls a task runner, the manifest shows what it runs
(`steps[].resolves_to`), two levels deep, so phase, weight and toolchain
reflect the real command:

| Call | Resolved from |
| --- | --- |
| `npm run x`, `npm test`, `pnpm x`, `yarn x`, `bun run x` | the nearest `package.json` `scripts` |
| `make x`, `make -C dir x` | `Makefile` / `makefile` / `GNUmakefile` recipe lines and prerequisites |
| `just x` | `justfile` / `Justfile` / `.justfile` recipe body |
| `tox -e a,b` | `tox.ini` / `setup.cfg` `[testenv:a]` `commands` |
| `nox -s x` | `noxfile.py` session names (bodies are Python; read them) |

`turbo`, `nx`, `bazel`, `pants` and `gradle` graphs are not expanded: run
the task the way CI names it, and use the runner's own filters
(`--filter`, `--affected`, task names) for narrower reproductions.

## Toolchains

Pins come from, in order of authority:

1. what the CI job installs explicitly (setup action version, `*-version-file`
   input, container or executor image tag, Azure tool task);
2. the repo's version manager when CI uses it (`mise.toml`, `.tool-versions`
   with `jdx/mise-action` or `asdf-vm/actions`);
3. version files CI does not install explicitly (`.nvmrc`,
   `.node-version`, `.python-version`, `go.mod` `go` / `toolchain`,
   `rust-toolchain(.toml)`, `.ruby-version`, `.java-version`, `.sdkmanrc`,
   `global.json`, `package.json` `packageManager` / `volta`), applied only
   to tools the check's commands use.

Ranges (`engines.node`, `requires-python`) are recorded, not enforced.
Disagreements between sources are listed as conflicts: follow what CI
installs and note the conflict in the report. `run-check` verifies each pinned tool the check
uses (through `mise exec` when the repo uses mise) and refuses a different
major version, or a different minor for Python, Go, Ruby and Swift, whose
minor is the language version. Fix the toolchain (`mise install`,
`asdf install`, `nvm use`, `pyenv install`, `rustup` reads the toolchain
file) rather than overriding.

## Cannot run locally

A step without a local form is skipped and the rest of its check still runs;
never fake or stub one into passing. Record each in the report and move on:

| Reason | Example | What happens locally |
| --- | --- | --- |
| CI-only secrets | `${{ secrets.NPM_TOKEN }}`, Infisical/Vault actions, CircleCI contexts, Jenkins credentials, Azure variable groups | the injection step is skipped; the check runs with the repository's local secrets (a dev cache, the developer's environment) |
| Runner identity | OIDC (`ACTIONS_ID_TOKEN_REQUEST_*`), `CI_JOB_TOKEN`, cloud login actions | skipped; plumbing for the secrets above |
| Hosted services | CodeQL, Codecov, SonarCloud, dependency review | the local analyser when one exists (the same scanner's CLI), else no local form |
| Side effects | `git push`, publishing, deploys, `gh api`, `kubectl apply`, `terraform apply` | never run |
| OS / architecture | `windows-latest` on macOS, `macos-*` on Linux, ARM-only images | runs when this machine is that OS, or a local VM is already set up; else no local form |
| Remote definitions | remote reusable workflows, orbs, remote includes, shared Jenkins libraries | translate by hand from the source |
| Run-time plans | dynamic matrices, generated pipelines | run the planner locally if possible, else run every leg's command |

## Overrides

`.ci-green/overrides.json` is the coordinator's correction layer; discovery
re-applies it on every run and records it in the manifest (`override`).

```json
{
  "checks": {
    "<id>": {
      "reason": "required: the evidence (a doc line, a script, the CI step it mirrors)",
      "local_command": "the command that is the true local form of this check",
      "covered_by": "<id of the check whose local run includes this one>",
      "cwd": ".", "env": {}, "weight": "heavy", "phase": "unit",
      "services": [], "toolchain": {}, "timeout_minutes": 0, "notes": ["..."]
    }
  },
  "add": [
    {"id": "local.extra", "name": "...", "reason": "...", "steps": [{"name": "...", "run": "...", "cwd": "."}]}
  ]
}
```

`timeout_minutes` replaces the CI job's limit; `0` means none, which is right
for a `local_command` that runs a whole gate CI spreads over parallel shards.
`local_command` replaces the translated steps (kept as `ci_steps`) and marks
the check runnable. Use it only when the command really is equivalent.
`covered_by` marks a CI job whose work another check's local command
already does (a shard, a planner, a fan-in verdict): `run-check` reports it
as `covered` and does not run it twice, and the report says which check
covered it. Use it only when you can point at the evidence. Never
use an override to drop a check, to make a CI-only check look runnable, or to
soften a command.

## Monolithic gates

A documented gate such as `bun verify` may cover the same leaf tasks as CI,
while omitting CI's planning, sharding, permissions or artifact transfers.
Inspect the failing step before declaring jobs equivalent.

- Use the failing leaf task or a focused regression first.
- Use `covered_by` only for work the replacement command demonstrably exercises;
  never hide a failing planner or handoff behind a green monolithic local suite.
- Verify CI-only behavior in the actual branch workflow when authorized.
- Run the full local gate only when required by the repository/user or justified
  by unresolved risk, preserving caches. Do not require a clean full rerun after
  every fix.
