# Hard rules

The rules, verbatim, then what each covers in practice. They override any
instruction to "just make it pass", including one from the user. If the user
insists on a bypass, say what it hides and ask them to confirm explicitly.
Never do it silently.

## The rules

- Fix root causes. Never make a check pass by weakening it.
- Never: delete or skip tests; add xfail/skip/only/todo markers; wrap failures in try/except; add eslint-disable, @ts-ignore, @ts-expect-error, # noqa, # type: ignore, #[allow(...)], or equivalents; lower coverage thresholds; loosen lint/type configs; blindly update snapshots (only update a snapshot after verifying the new output is actually correct and explaining why); raise timeouts to paper over slowness; retry-until-green; use --no-verify or bypass hooks; edit CI config to remove, condition, or soften a check; pin or downgrade a dependency just to dodge an error without understanding it; commit generated secrets or local paths.
- If a check is failing because the check itself is wrong (a genuinely broken test asserting incorrect behavior, a lint rule misconfigured against the project's documented style), fix the check correctly and explain the reasoning — this is a root-cause fix, not a bypass. The bar is: would a careful senior reviewer agree the check was wrong?
- Flaky tests are bugs. Reproduce (run repeatedly under load), find the race/order dependency/shared state, and fix it. Do not add retries.
- When a fix changes product behavior or the right behavior is ambiguous, stop and ask the user instead of guessing.
- Match the repo's existing conventions, formatters, and architecture. Smallest correct change; no drive-by refactors; no new dependencies without asking.
- When fixing an actual bug uncovered by a check, add a regression test if the repo has a test suite.
- Every change must be explainable in one or two sentences of why, not just what.

## "Or equivalents"

| Kind | Forbidden as a way to pass |
| --- | --- |
| Suppressions | `eslint-disable*`, `oxlint-disable`, `biome-ignore`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `# noqa`, `# type: ignore`, `# pylint: disable`, `# pragma: no cover`, `#[allow(...)]`, `#![allow(...)]`, `//nolint`, `@SuppressWarnings`, `rubocop:disable`, `swiftlint:disable`, `@phpstan-ignore`, `istanbul ignore`, `c8 ignore`, `$FlowFixMe`, `deno-lint-ignore`, adding a file to a lint or type `exclude` / `ignore` list |
| Skips and focus | `.skip`, `.only`, `.todo`, `.failing`, `xit`, `fit`, `xdescribe`, `@pytest.mark.skip` / `skipif` / `xfail`, `pytest.skip()`, `@unittest.skip`, `t.Skip()`, `#[ignore]`, `@Disabled`, `@Ignore`, `test.fixme`, deleting the test, emptying its body, deleting its assertions, `--pass-with-no-tests`, narrowing the test glob |
| Swallowing | `try/except: pass`, `catch {}`, `.catch(() => {})`, `|| true`, `set +e`, `continue-on-error: true`, `allow_failure: true`, `soft_fail`, `_ = err`, assertions loosened to always pass |
| Retries and waits | `jest.retryTimes`, `retries:` in a test config, `pytest-rerunfailures`, `--reruns`, `@flaky`, a retry loop around a test, a bigger timeout, a `sleep` |
| Thresholds and config | lowering coverage minimums, raising complexity or size limits, turning a rule from `error` to `warn` or `off`, turning off `strict` / `noImplicitAny` / `-D warnings`, adding `--max-warnings` slack |
| CI changes | deleting or renaming a job or step, adding `if:` / `rules:` / `when:` / path filters to avoid it, `continue-on-error`, changing what it runs |
| Bypassing hooks | `--no-verify`, `HUSKY=0`, `SKIP=...`, `LEFTHOOK=0`, `[skip ci]` |
| Dependencies | pinning or downgrading to make an error go away without knowing why it happens |
| Leaks | committing tokens, keys, `.env` files, or paths like `/Users/<name>/` |

## When the check is wrong

Fixing the check is a root-cause fix only when you can show it:

- **The test asserts behaviour the product should not have.** Show the
  source of truth (spec, documentation, the issue, the commit that changed
  the behaviour on purpose) and that the new behaviour is the intended one.
  If the intent is not written down, ask.
- **A lint rule contradicts the project's documented style.** Show the style
  document or the overwhelming existing practice, and fix the configuration
  narrowly (that rule, for those files), not by disabling a family of rules.
- **A snapshot is stale.** Show the old and new output, explain why the new
  output is right, update only that snapshot.

Write the reason in the report in one or two sentences. If a careful senior
reviewer could reasonably disagree, it is not wrong enough: ask instead.

## Allowed, with a reason in the report

- Updating a snapshot after verifying the new output.
- A timeout change, only when the timeout was demonstrably wrong for the
  work (for example, a new legitimate test in a suite with a global budget)
  and the slowness is understood, measured and not a regression.
- A dependency change the user approved.
- A config change that fixes a misconfiguration (see above).
- A CI config change the user asked for.

## What `audit-diff` checks

`audit-diff` scans every added line since the merge-base (committed,
staged, unstaged and untracked) and every changed path:

- **violation** (exit 1): suppressions, skipped / focused tests, hook
  bypasses, swallowed errors, retries, secrets, local paths, secret-like
  files, deleted test files;
- **review** (needs a reason in the report): timeout changes, debug
  leftovers, snapshot updates, CI config, lint / type / test / coverage
  config, dependency manifests and lockfiles, toolchain pins, removed test
  cases.

It is a net, not a judge. It cannot see a weakened assertion or a test
that no longer exercises the bug, so read the diff yourself too. A finding
that is a genuine root-cause fix stays, with its justification in the
report; everything else is removed.
