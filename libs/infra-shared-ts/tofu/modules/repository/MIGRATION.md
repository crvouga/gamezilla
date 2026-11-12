# Agent-first repository policy: migration record

The product repository (`var.github.owner`/`var.github.repo`, see `envs/global.tfvars.json`), a **public repository owned by a personal account**.
This module (bootstrap stack, encrypted state in R2) already owned the
repository before this change; Release applies it and Health checks it for
drift hourly. Nothing moved to a new `infra/github/` root: two roots would own
the same resources and undo each other.

## Inventory before this change (2026-11-09)

| Setting | Was | Now |
| --- | --- | --- |
| Merge methods | merge commit only | squash only (`PR_TITLE` / `PR_BODY`) |
| Auto-merge, delete branch on merge, update branch | on | on (unchanged) |
| `main` ruleset | deletion, non-fast-forward, PR (0 approvals, dismiss stale, thread resolution), required checks, **up to date required** (turned off by #337) | adds `creation`, `required_linear_history`, `allowed_merge_methods = ["squash"]`, admin bypass through a pull request only |
| Required checks | `verify:start`, `verify:end`, `CodeQL`, `Analyze (actions)`, `Analyze (javascript-typescript)`, `preview` | the ruleset requires `verify:start` and `verify:end`; `verify:end` enforces the `outage_tolerant` CodeQL checks (findings block, an unavailable scanner warns) and waits for the `advisory` `preview` check without blocking on its verdict |
| Bypass actors | none | repository admin role (`actor_id` 5), `pull_request` mode |
| Tag protection | none | `release-*`: no deletion, no update |
| Legacy branch protection | none (`removed` block already forgets the old address) | none |
| Actions | any action, SHA-pinned | GitHub-authored, verified creators, `Infisical/secrets-action@*`, `jdx/mise-action@*`; SHA-pinned |
| Workflow token | read-only, cannot approve PRs | unchanged |
| Labels | 58, unmanaged | 62 fixed labels managed one file each (`labels/`), 58 adopted by `import` (`needs-human` was created by hand for #341), 4 created; dated `overnight:<date>` labels stay unmanaged |
| Environments | `production` main-only, no reviewers | unchanged |
| Vulnerability alerts, Dependabot security updates | on | unchanged |
| Wiki, projects | off | unchanged |

## What GitHub or the provider cannot do here

Each item was tested against the live API on 2026-11-09 with a ruleset created
`disabled` and deleted right after.

- **Merge queue.** Only organization-owned repositories get one. Without it,
  `main` does not require up-to-date branches, every PR's checks run against the
  merge commit at push time, and Release reruns the full gate on `main` before
  shipping. Two PRs that pass separately but break together can land on `main`;
  they fail Release and do not ship. Moving the repository to an organization
  would enable it:

  ```sh
  gh api -X PUT repos/<org>/<repo>/rulesets/<main-ruleset-id> --input ruleset.json  # add {"type":"merge_queue", ...}
  ```

  and it is expressible in this module (`rules { merge_queue { … } }`, provider 6.13).
- **Branch name patterns** (`agent/*`-only branches). Refused on this repository:

  ```sh
  gh api -X POST repos/{owner}/{repo}/rulesets --input - <<'JSON'
  {"name":"branch-names","target":"branch","enforcement":"active",
   "conditions":{"ref_name":{"include":["~ALL"],"exclude":["~DEFAULT_BRANCH"]}},
   "rules":[{"type":"branch_name_pattern","parameters":{"operator":"regex","pattern":"^(t3|cursor|fix|feat|chore|ci|docs|refactor|perf|test|ui|evidence|overnight|dependabot)/","negate":false}}]}
  JSON
  # 422 Invalid rule 'branch_name_pattern'
  ```

  Agents today use many prefixes (`t3/`, `fix/`, `feat/`, `ui/`, `evidence/`,
  `cursor/`, `dependabot/`…), so one prefix would also break the harnesses.
- **Restricting tag creation to Release.** GitHub refuses the Actions
  integration as a bypass actor on a user-owned repository
  (`422 Actor GitHub Actions integration must be part of the ruleset source or
  owner organization`), so blocking creation would block Release's tag. Tags
  are protected from deletion and update only.
- **Organization settings and organization rulesets.** Not applicable to a
  personal account.

## No GitHub Apps (decided)

The repository follows a zero-manual-configuration policy. Registering and
installing a GitHub App needs clicks in GitHub's UI (neither the provider nor
the API can create one), so there are none. OpenTofu keeps authenticating with
`GITHUB_ADMIN_TOKEN` (Infisical, `shared` environment), and agents push as the
maintainer. Consequences:

- No `app_auth` provider block; the token is the one credential.
- Agent PRs cannot be told apart by author, so PR Hygiene does not apply
  `agent-generated` automatically; the label exists for agents to add.
- No app is ever a bypass actor; the admin role is the only one.

## Deliberate departures from the requested spec

- **Required checks stay `verify:start` + `verify:end` (+ CodeQL)**, not
  separate `lint` / `typecheck` / `unit` / `workflow-lint` jobs. Verify PR is one
  content-addressed, Turbo-cached, sharded plan; splitting it would lose the
  cache and the shard packing. `actionlint`, `zizmor` and the SHA-pinning test
  already run inside it.
- **No AI review check.** Decided by the maintainer: CI is the only gate.
- **PRs open ready for review, not draft.** A draft cannot auto-merge, and the
  maintainer asked for ready by default.
- **PR Hygiene runs on a schedule (every 15 minutes), not on `pull_request`.**
  Verify PR's final gate fails any PR check that is not required
  (`required-pr-checks.ts`); scheduled runs are not PR checks. It does not run
  `update-branch` on behind PRs: without a merge queue that reruns full CI for
  nothing.
- **Labels are managed one resource each, not authoritatively.** An
  authoritative set would delete `/overnight`'s dated labels on every apply.
- **No reviewer on `production`, and repository policy still applies in
  Release.** Release ships every merge unattended; a required reviewer would put
  a human click on every merge.

## Verify after apply

Run as the maintainer:

1. `gh api repos/{owner}/{repo}/rulesets` lists `main` and `release-tags`;
   `gh api repos/{owner}/{repo} -q '{allow_squash_merge,allow_merge_commit}'`
   is `{true,false}`.
2. Open a trivial PR, `gh pr merge --auto --squash`: it stays open while
   `verify:end` is pending or red.
3. When green it squash-merges by itself and its branch is deleted.
4. `git push origin HEAD:main` is rejected (`GH013`), even for the admin.
5. `git push origin :refs/tags/release-<n>` is rejected.
6. `gh workflow run pr-hygiene.yml` succeeds; a PR labelled `do-not-merge`
   loses auto-merge.
