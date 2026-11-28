# Architecture checks

Run from the repository root after `bun install --frozen-lockfile`.

| Question | Command | Result |
| --- | --- | --- |
| Which packages does a change touch directly? | `bun run deps:graph --package @libs/profile-client-ts` | Direct dependencies and dependents from runtime module references in production `src/` files |
| Which packages form cycles or have the most neighbors? | `bun run deps:graph --summary` | Mutually reachable groups and the ten packages with the most outgoing and incoming edges |
| Which runtime cycles fail Nightly? | `bun run deps:cycles` | Fails on any mutually reachable group of packages or of modules inside one package, including self-imports. Lists the members of each group. |
| Does tooling change that graph? | `bun run deps:graph --all --summary` | Includes tracked JavaScript and TypeScript under apps, libs and pkgs, including tests, scripts, config and Storybook |
| What did the manifests declare? | `bun run deps:graph --declared --json --output .cache/architecture/declared.json` | Sorted direct targets per package across all dependency sections and workspace languages |
| Which tasks does an edit invalidate? | `bun run cache:explain @libs/profile-client-ts` | Turbo source hashes and downstream task scope |
| Which constraints does a package violate? | `bunx turbo run lint tc test --filter=@libs/profile-client-ts` | Package boundaries, complexity limits, compiler checks and package tests |
| Where are the exact code clones? | `bun run deps:duplicates` | File pairs and line ranges in `.cache/architecture/jscpd-report.json` |
| Which files should I examine for complexity? | `bun run deps:complexity` | Ranked files and folders in `.cache/architecture/jscpd-complexity.json` |
| Which files or exports lack known consumers? | `bun run deps:unused` | Knip candidates and detected module cycles in `.cache/architecture/unused.json`. Append `--workspace @libs/profile-client-ts` to focus on one package. |

With no flags, `deps:graph` opens the HTML package diagram. Use `--json` for the adjacency list, `--output <path>` to save JSON, and `--package <name>` with any scope to inspect one node. Edges point from importer to imported package. The source graph counts literal imports, re-exports and require calls, including relative paths between packages. It omits explicitly type-only references, computed targets and native source. The default scope excludes colocated tests, stories and examples. Package cycles can arise from different files in the two packages. Inspect the module references before changing code.

Affected package lint already runs Biome's `noImportCycles` rule over the package and its declared dependency closure. It detects cycles between resolved files and permits direct self-imports.

Nightly's coverage group runs `deps:cycles` over the same tracked files as `--all`. The package check counts references to known workspace packages, including references from fixtures and scripts. A package cycle can span otherwise independent files. Within each package, the module check follows relative paths with Bun's resolver and self-imports through the package's exports (Bun/Node import conditions and the first existing array target). Only tracked JS and TS implementation files can form module cycles. A literal `import('./file')` contributes an edge even when it loads lazily. The check lists unresolved relative and self-package references separately. Computed imports, glob expansion, generated files, other conditional export targets and third-party modules fall outside this check.

Nightly retains the three whole-workspace code reports in its coverage artifact. jscpd compares TypeScript and TSX using a minimum of 12 lines and 100 tokens per clone. Its complexity score ranks whole files. Biome enforces the repository's configured limits on individual functions and files. Knip reports candidates for inspection. Runtime discovery, generated code and public entry points require checking consumers before removing an export. Its configuration lists the browser harness entry points so analysis can run without a browser installation.

To prepare a structural change, use the pinned `ast-grep` to preview the match and rewrite. For example, `mise exec -- ast-grep run -l tsx -p 'useProfileRow($ID)' libs/profile-client-ts` lists matches. Add `--rewrite '<replacement>'` to preview a diff, then `--update-all` to apply it. Use TypeScript references for symbol renames. Review the diff and run the owning package and consumer checks. For module and symbol relationships across languages, use the [Graphify workflow](../AGENTS.md#code-graph).
