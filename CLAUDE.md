# Repository agent entry

Follow [`AGENTS.md`](AGENTS.md) in full.

For acceptance behavior, also follow
[`specs/README.md`](specs/README.md): feature files belong to
spec-only commits, implementers do not edit their wording, and the generated
step catalogs are the supported vocabulary.

## UI source of truth

[`design-system/`](design-system/) defines all UI and is the design
system's only source of truth. The Gamezilla design-system artifact on
claude.ai (https://claude.ai/artifact/WhfG2jxcpi2strAy8Z6dB7) is a published,
read-only view of it: never edit the artifact directly.

Before building or changing any screen:

1. Read [`design-system/README.md`](design-system/README.md) and
   [`design-system/spaces.md`](design-system/spaces.md).
2. Use only tokens from [`design-system/tokens.json`](design-system/tokens.json);
   never hard-code a color, size, radius or font name. The UI lint
   (`design-vocabulary.ts`) fails on raw hex, pixel literals and font names
   outside the generated token files.
3. Build from the components in `@pkgs/ui` (`pkgs/ui-root-client-ts`, every
   one in Storybook) before adding a new one.
4. If a screen needs a rule, token or component that isn't there, add it to
   `design-system/` (and `@pkgs/ui`) in the same change.

A UI task is not done until lint and the visual tests pass
(`bun run design:check`). Never update visual baselines unless the user asks
for it.

## Changing the design system

Design changes start here, from a local session or from a cloud Claude
session that the Claude web app opened on this repository. Either way:

- Edit `design-system/` and the components in `pkgs/ui-root-client-ts`;
  never the Gamezilla artifact. It is republished from `main` after merge.
- Work on a branch named `design/<short-topic>`, open a pull request, and
  never push to `main`. The PR gate (Verify PR: token generation, lint, the
  Storybook build and the visual tests) must pass before it merges.

Commands, from a fresh clone on Linux (`mise.toml` pins Bun, Node and the
Chrome for Testing build the screenshots use; Playwright is pinned in
`package.json`):

| Step | Command |
| --- | --- |
| Install | `curl https://mise.run \| sh` (once, if mise is missing), then `mise install && bun install` (`bun install` also generates tokens and other generated sources) |
| Generate tokens | `bun run tokens:generate` |
| Lint | `bun run lint` |
| Storybook (dev) | `bun run design:story` |
| Storybook build | `bun run storybook:build` |
| Visual tests | `bun run storybook:test` (`-- --grep <story-id>` for some) |
| All of the above | `bun run design:check` |

Repo scripts for the workflow:

- `bun run design:edit` starts an interactive Claude Code session in the
  current checkout, primed by
  [`scripts/DESIGN_EDIT.prompt.md`](scripts/DESIGN_EDIT.prompt.md): it reads
  this file and `design-system/`, moves to a `design/<topic>` branch, starts
  Storybook and asks what to change.
- `bun run design:check` runs token generation, lint, the Storybook build
  and the visual tests, then prints where the expected, actual and diff
  images are (`pkgs/ui-root-harness-ts/.cache/storybook-test-results`).
- `bun run design:sync` republishes the Gamezilla artifact from the
  committed code (it refuses while `design-system/` has uncommitted
  changes). The Design Sync workflow runs it on every merge to `main` that
  touches `design-system/` or the component library.
- `bun run design:story` starts Storybook alone.

**Visual baselines.** Screenshots are compared against the committed
`baselines/` PNGs, and those are authored only on the CI Ubuntu runner, so a
cloud session, a laptop and CI judge the same pixels. A failing PR shard
uploads its expected, actual and diff images as the `visual-diffs-<n>`
artifact (`gh run download <run-id> -n visual-diffs-<n>`). A pull request
that intentionally changes how something looks updates its baselines in the
same pull request: dispatch
`gh workflow run verify-nightly.yml --ref design/<topic> -f group=storybook -f update-storybook-baselines=true -f storybook-pattern=<story-id regex>`,
decode and apply the patch from that run's log as
[`pkgs/ui-root-harness-ts/README.md`](pkgs/ui-root-harness-ts/README.md#browser-checks-and-baselines)
describes, commit it, and list every changed story id in the PR description.
Never update baselines to make an unrelated failure pass, and never without
the user's request.
