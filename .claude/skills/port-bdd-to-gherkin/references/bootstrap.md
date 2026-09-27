# Bootstrapping the runner (only if `@pkgs/gherkin` / `@pkgs/quint` are missing)

Confirm with the user first. This step adds packages and root scripts.

Prior work lives on branch `backup/quint-test-caching-merged` (not merged to
main). Its product-agnostic pieces are the base. Its product layer targets a
`libs/sim-harness` that main doesn't have (main composes the product sim in
`@apps/product`), so rewrite that layer instead of copying it.

```sh
B=backup/quint-test-caching-merged
git show "${B}:docs/SPEC_DRIVEN_DEVELOPMENT.md"      # the full design
git checkout "$B" -- pkgs/gherkin pkgs/quint           # agnostic runners + their tests
git show "${B}:.claude/agents/spec-writer.md"          # role prompts (also implementer, step-auditor)
```

(In zsh, always write `"${B}:path"`. A bare `$B:l…` triggers history
modifiers.)

Then:

1. Add the catalog deps: `@cucumber/gherkin`, `@cucumber/cucumber-expressions`,
   `@cucumber/messages`, `@cucumber/tag-expressions`, and
   `@informalsystems/quint`. Wire `tsconfig` paths/includes, then `bun install`.
2. Reconcile both packages with main's current `biome.json`, `tc` script
   shape, and syncpack. `bun run --filter @pkgs/gherkin test` and
   `--filter @pkgs/quint test` must pass before you port any tests.
3. Runner design constraints (spike, 2026-09):
   - Run on `bun test`, never cucumber-js. The sim preloads call `bun:test`
     `afterEach` and rely on `Bun.plugin`, and cucumber's `--parallel` crashes
     under Bun.
   - Register features at collection time from one entry per package, or from
     generated stubs in `.cache/spec/` (never committed). `bun test` only
     discovers `.test`/`.spec` names, and explicit paths need `./`.
   - Tag filtering goes through an env var, and `-t` filters scenario names.
     JUnit output feeds `@pkgs/sim-report`.
4. Per package: add a `tests/features.test.ts` entry (or `test:e2e`) that
   imports `tests/steps/**` and runs its features and models. Make the spec
   dirs (`$TURBO_ROOT$/specs/<domain>/**` or `tests/features/**`,
   `tests/quint/**`) Turbo inputs of that task, so it caches and reruns only
   when specs or code change.
5. Root scripts (`spec`, `spec:check`, `spec:catalog`): port them from the
   backup branch only once a second package needs them. A single package can
   use its own `test` script.

Commit the bootstrap on its own, before any ported tests.
