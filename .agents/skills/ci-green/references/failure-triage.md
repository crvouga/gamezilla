# Failure triage

Cluster failures by root cause, find the cause, and fix it once.

## Contents

- [Method](#method)
- [Environment before code](#environment-before-code)
- [Signatures by ecosystem](#signatures-by-ecosystem)
- [Common root causes](#common-root-causes)
- [Flaky tests](#flaky-tests)
- [CI passes, local fails (and the reverse)](#ci-passes-local-fails-and-the-reverse)

## Method

1. `triage-failures` reads `.ci-green/results/*.json` for the current commit
   and links failures that share a normalised error (code and message shape
   with numbers, hashes, paths and quoted names masked), a file, or a missing
   module. Each cluster has a lead line, its checks, files, tests and the
   command to reproduce.
2. Read the lead line and the log tail of every cluster. The script groups
   by text; you group by cause. Merge clusters whose errors are consequences
   of one change (a renamed export breaks every importer); split a cluster
   that only shares a busy file.
3. Order the queue: environment clusters first, then build and import
   errors, then types, then lint and formatting, then tests. Fixing an
   upstream error often clears everything after it, so re-run before
   starting the next cluster.
4. One cluster, one root cause, one explanation. If you cannot state the
   cause in a sentence, you have not found it yet.

## Environment before code

These are fixed in the environment, never by editing the code under test:

| Signature | Cause | Fix |
| --- | --- | --- |
| `toolchain-mismatch`, `requires node >= ...`, `Unsupported engine`, `SyntaxError` on modern syntax | wrong runtime version | install CI's version via the repo's version manager |
| `command not found`, `No such file or directory` for a tool | tool missing | install it the way CI does (setup step, version manager, dev dependency) |
| `Cannot find module` / `ModuleNotFoundError` right after a lockfile change | stale install | frozen install (`npm ci`, `pnpm install --frozen-lockfile`, `bun install --frozen-lockfile`, `uv sync --frozen`, `poetry install --sync`) |
| `ECONNREFUSED`, `could not connect to server`, `Cannot connect to the Docker daemon` | service not running | start it through `run-check` (or the repo's service script) |
| `EADDRINUSE`, `address already in use` | something already holds the port | find the holder; never start a second copy |
| `Killed`, exit 137, `JavaScript heap out of memory`, `OOMKilled` | memory | run alone; report the requirement |
| `No space left on device`, `ENOSPC` | disk | clean build outputs and caches |
| `mise ERROR`, `pyenv: version ... not installed`, `asdf: No version is set` | version manager has no version for this directory | `mise install` / `asdf install` / `pyenv install` the pinned version |

Only when the environment matches CI is a code failure real.

## Signatures by ecosystem

What the extractor recognises, and what it usually means:

| Ecosystem | Lines | Usually |
| --- | --- | --- |
| TypeScript | `file.ts(12,5): error TS2304`, `file.ts:12:5 - error TS2322` | TS2307 cannot find module → wrong import path or missing export map entry; TS2304/TS2552 undeclared name; TS2322/TS2345 a real type error; TS7006 implicit any |
| ESLint / Biome / oxlint | `12:5 error message rule-name`, `file:12:5 lint/...` | a rule the repo chose; fix the code, not the rule |
| Prettier / Black / gofmt / rustfmt / Biome format | `Code style issues found`, `would reformat`, `Diff in` | run the repo's formatter in write mode on the files it names |
| Jest / Vitest / Bun / Mocha | `● Suite › test`, `FAIL path`, `(fail) name`, `✕` | read the assertion diff; snapshot mismatches need the new output checked before any update |
| Python | `FAILED tests/x.py::test_y - AssertionError`, `E   ...`, tracebacks, `ModuleNotFoundError` | assertion or import; pytest `ERROR` (not `FAILED`) means a fixture or collection error |
| mypy / pyright | `file.py:12: error: ... [code]` | real type error, or missing stubs (add them as a dev dependency only with the user's agreement) |
| Ruff / Flake8 / Pylint | `file.py:12:5: F401 ...` | unused import, undefined name, style |
| Go | `--- FAIL: TestX`, `file.go:12:5: ...`, `panic:` | test failure, compile error, nil dereference; `-race` reports a data race |
| Rust | `error[E0432]: unresolved import`, `--> src/x.rs:12:5`, `test x ... FAILED`, `clippy::` | compile error; clippy lint the repo enforces with `-D warnings` |
| JVM | `[ERROR] File.java:[12,5]`, `Tests run: ... Failures: 1`, Kotlin `e: file.kt:12:5` | compile error; surefire report under `target/surefire-reports` |
| Ruby | `rspec ./spec/x_spec.rb:12` | the failing example |
| C / C++ / Swift | `file.c:12:5: error:` | compile error |
| Shell | `In file line 12:` (shellcheck) | the SC code names the problem |
| Generic | `npm ERR!` / `npm error`, `ERR_PNPM_*`, `make: ***`, `exit status N`, `Process completed with exit code N` | look above these lines: they report a failure, they are not the failure |

## Common root causes

- **One rename, many failures.** A renamed or moved symbol fails lint
  (unused import), typecheck (cannot find name) and tests (import error) at
  once. Fix the reference, not each symptom.
- **Generated code out of date.** Schema, protobuf, GraphQL, ORM, i18n
  catalogs, route trees. Run the repo's generator; never hand-edit generated
  output.
- **Lockfile drift.** `package.json` changed without the lockfile, or the
  reverse. Regenerate the lockfile with the package manager CI uses, at
  CI's version.
- **Platform differences.** Case-insensitive macOS filesystems hide import
  case errors that fail on Linux CI; GNU vs BSD `sed`, `date`, `find`;
  line endings; locale-dependent sorting. Fix the code to be portable.
- **Time and order.** Tests depending on the current date, timezone, test
  order, random seeds, or a previous test's state. See flaky tests.
- **Snapshot changes.** A snapshot fails because the output changed. Decide
  whether the new output is correct (does it match the intended behaviour
  of the change on this branch?). If yes, update only that snapshot and say
  why; if not, fix the code.
- **The check is wrong.** A test asserting incorrect behaviour, a lint rule
  misconfigured against the project's documented style. Fix the check, and
  explain why a careful senior reviewer would agree. See
  [hard-rules.md](hard-rules.md#when-the-check-is-wrong).

## Flaky tests

A flaky test is a bug in the test or in the code. Never add retries or raise
timeouts.

1. **Reproduce under load.** Run it repeatedly while other checks keep the
   machine busy, so timing bugs show:
   ```sh
   run-check <id> --repeat 30 --until-fail
   run-check --adhoc flaky-x --like <id> --cmd "<the single test>" --repeat 50 --until-fail
   ```
   Runners' own repetition helps too: `pytest -p randomly` /
   `pytest --count 50` (if the repo has pytest-repeat), `go test -count=50
   -race -shuffle=on`, `cargo test -- --test-threads=1` vs default, `jest
   --runInBand` vs default, Playwright `--repeat-each=20`.
2. **Classify.** Fails alone too → nondeterminism inside the test (time,
   randomness, unordered iteration, floating point). Fails only with other
   tests → shared state or order dependency (globals, singletons, database
   rows, files, environment variables, mocked modules not restored). Fails
   only under load → a race or an unawaited promise / missing join / sleep
   used as synchronisation.
3. **Fix the cause.** Inject the clock and seed; await what you started;
   synchronise on the event, not on a delay; isolate state per test (fresh
   fixture, transaction rollback, temp directory); restore mocks; sort
   before comparing unordered results.
4. **Prove it.** Run the same repetition that reproduced it and report the
   count of consecutive passes, before and after.

## CI passes, local fails (and the reverse)

- Local fails, CI passes: compare toolchain versions (the result file
  records them), environment variables (`CI=true` is set by `run-check`;
  check for tools reading `CI`), services, OS, locale, timezone (`TZ=UTC`
  is common in CI), file permissions, and leftovers from earlier local
  builds. Fix the environment, or make the code robust to the difference if
  CI could hit it too.
- Local passes, CI fails: the job does something the local run skipped
  (look at `skipped_steps` in the result), runs on another OS, in a
  container, with a cold cache, or in parallel shards. Read the CI log
  itself (for GitHub: `gh run view <id> --log-failed`) and reproduce that
  exact step.
