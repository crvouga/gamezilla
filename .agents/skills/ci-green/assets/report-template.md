# CI green report

Branch `<branch>` against `<base>` (merge-base `<sha>`), <n> files changed.
Toolchain: <tool versions>, matching CI <yes / differences below>.
Budget: <cores, memory, parallel checks / subagents used>.

## Checks

| Check | Local result | Notes |
| --- | --- | --- |
| <name> (`<id>`) | passed / no local form | <duration, reason, path filter> |

Full suite from a clean state: <command>, <tasks> tasks, <passed at time>.

## Fixes

### <cluster id>: <short title>

- Root cause: <one or two sentences>
- Change: <files> — <what changed>
- Why it is correct: <one or two sentences>
- Verification: `<command>` <failed before> → <passed after>; full suite <passed>
- Regression test: <path, or "not applicable: <why>">

## No local form

| Check or step | Why it has no local form |
| --- | --- |
| <name, or "none"> | <OS or architecture this machine lacks / hosted service with no stand-in> |

## Review notes

<each remaining audit-diff review finding (snapshot, config, dependency,
timeout) with its one-or-two-sentence justification; toolchain conflicts;
any use of --allow-toolchain-mismatch>

## Product decisions

- <only a fix that would change product behaviour, or "none">

All changes are on `<branch>`, for one pull request. <Committed and pushed / Not committed.>
