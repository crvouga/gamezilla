# Solid tests in Bun

Run DOM suites through the package's Turbo `test` task. Its Bun command uses
the canonical workspace compiler configuration:

```sh
bun test --tsconfig-override ../../tsconfig.json --conditions=browser --conditions=development --preload @pkgs/bun-test-solid-client-ts/preload tests
```

The explicit config keeps public workspace imports consistent between a
worktree and the private snapshots used by full verification. Preserve it in
contract and other Solid test commands too. Package lint enforces this command
contract; the flag's path is configuration, never a test filter.

The preload compiles real Solid components, installs the DOM environment and
matchers, activates localization, and cleans up each test's mounted trees.
Production components retain their normal public module imports. Test layout
and deterministic verification policy are defined in [AGENTS.md](../../AGENTS.md).
