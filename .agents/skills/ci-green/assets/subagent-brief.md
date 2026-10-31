# Subagent brief: <cluster id> — <one-line cause guess>

You are fixing one failure cluster for a coordinator who owns the plan. Work
only on this cluster.

## Failing

- Checks: <check ids and names>
- Reproduce: `<SKILL_DIR>/scripts/run-check <id>`
  (narrower: `<SKILL_DIR>/scripts/run-check --adhoc <name> --like <id> --cmd "<single test or file>"`)
- Logs: <hosted run URL, attempt, tested SHA, job/step; saved log paths>
- Lead lines:
  ```
  <signature lines from triage>
  ```
- Files involved: <paths>
- Toolchain: <tool versions CI uses>

## Repository conventions

Read before editing: <AGENTS.md / CONTRIBUTING.md / style guide paths>.
Formatter: <command>. Test layout: <where tests live>.

## Rules

<paste the Hard rules section of SKILL.md verbatim>

Also:

- Read the hosted failure first. Use a focused reproduction when practical;
  report when only the actual workflow can exercise the failure.
- Make the smallest change that fixes the root cause. Touch only the files
  this cluster needs; if the fix needs files outside <paths>, stop and
  report back first, because another subagent may own them.
- Do not edit `.ci-green/` or the overrides. Edit CI configuration only
  when the coordinator assigned that root cause and file ownership. Do not
  commit, push, or install new dependencies.
- If the right behaviour is ambiguous or the fix changes product
  behaviour, stop and report back with the question.
- If you fixed a real bug and the repo has tests, add a regression test.
- Re-run the reproduce command after the fix. Run it several times if the
  failure was intermittent.

## Hand back

1. Root cause: <one or two sentences>
2. Change: <files and what changed>
3. Why it is correct: <one or two sentences>
4. Verification: <commands re-run and their results, before and after>
5. Questions or follow-ups: <anything the coordinator must decide>
