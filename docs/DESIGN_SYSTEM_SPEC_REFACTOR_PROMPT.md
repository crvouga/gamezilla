You are refactoring the product's design system so that the specification is the source of truth and every implementation is generated from it. Read README.md (the product briefing) and specs/README.md first; obey them. Specs win over code; product behavior changes land in specs/ first in a `spec:` commit, then the code.

## Goal

Today the design system exists only as SolidJS + TypeScript code in @pkgs/ui (tokens, theme, 122 components registered in @pkgs/ui-root-client-ts/src/registry-entries-*.ts). Turn it into:

1. specs/design-system/ — pure, implementation-agnostic specs in open formats that fully describe the system.
2. A visualizer that renders the specs directly (no implementation needed to look at the system).
3. Codegen that produces the TypeScript/SolidJS implementation and a SwiftUI implementation from the specs, plus conformance tests that verify any implementation against the specs.
4. @pkgs/ui rewired so its hand-written code is replaced by generated code; nothing in @pkgs/ui that the specs can express remains hand-written.

Nothing about the shipped product may change: the app must look and behave identically before and after. Prove that with the existing verify gate and the visual corpus.

## Spec formats (open standards only)

- Tokens: W3C Design Tokens (DTCG) JSON. `core.json` (primitives), `semantic.<theme>.json` per theme (every UI color is an alias into core; `$description` says where it is used), `typography.json`, `$themes.json` (dark is default). No value in any component spec may be a literal; it must reference a token.
- Component contracts: one folder per component, `components/<ExplorerCategory>/<Name>/`:
  - `contract.yaml` validated by a JSON Schema (2020-12): name, category, status, summary, purpose, anatomy (parts), props (name, type in a small typed language: string | number | boolean | enum(...) | slot | fn(args) -> void | ref(Type) | list(T) | map(K,V), `?` optional, with defaults), variants, states (each mapped to the tokens it uses), tokens used, layout rules per window class (compact/medium/expanded), a11y (role, name, exposed states, keyboard map, announcements), testIds, related, platform-specific extras (only under `platform.<target>.extraProps` so additions are visible).
  - `<Name>.feature` — Gherkin behavior using one shared step vocabulary so a single file drives every platform harness.
  - `<Name>.md` — guidance (when to use, do/don't).
- Foundations: markdown rules for color (including a contrast matrix enforced in CI), typography, spacing/layout/breakpoints, motion, elevation, iconography (icons committed as SVG, names as an enum in the BrandIcon contract), content/voice, accessibility (WCAG 2.2 AA; "usable without sight and without a mouse"), and a platform-mapping table that fixes how tokens, props, enums, slots, events, test handles, a11y names and states are spelled in TypeScript and Swift.
- Vocabulary: the Words table and banned list from README.md as a lintable spec; banned words may not appear in strings, prop names, component names or test ids.
- Catalog: `components/registry.json` is the explorer's category → component list; CATALOG.md/catalog.json are generated from it and the contracts. The catalog must equal the registry exactly (122 names); CI fails on any mismatch.
- conformance.yaml: the proof each target must produce for each kind (tokens, contracts, behavior, accessibility, visual, vocabulary), fail-on UNKNOWN/skipped/stale/manual, mirroring specs/conformance.yaml.

## Extraction rules (code is truth today)

- Enumerate the full inventory first: every token (exact values, both themes), every registered component, every prop, variant, state, slot, event, keyboard behavior, a11y attribute, and the explorer category. Write the inventory to specs/design-system/EXTRACTION.md with a checklist and keep it updated; do not stop silently with gaps — report exactly what remains.
- Exact values. 5px stays 5px. Never snap to a grid, rename, or "improve" while extracting. Cleanups are a separate step after parity is proven.
- Every literal color, size, duration, font, radius or z-index found in @pkgs/ui that is not a token becomes a token in core.json with a `$description` naming where it is used; list these under "Promoted literals" in EXTRACTION.md.
- Derive states from the code's class/attribute branches; derive a11y from the actual roles/aria/handlers; derive keyboard maps from the handlers. Where the code lacks something the spec format requires (e.g. a component has no accessible name), record it as a `gap` in the contract and in EXTRACTION.md rather than inventing behavior.
- Keep explorer categories and the registry order.

## Visualizer

- Build a spec-driven explorer in @pkgs/ui-root-client-ts (or a sibling, per package-boundaries rules) that renders tokens, type scale, spacing, and each component's contract (anatomy, props table, states grid, a11y map) from the YAML/JSON directly, with both themes side by side. It must not import @pkgs/ui components to render spec pages; it may embed the generated Solid implementation in a separate "live" tab for comparison.
- `bun ds:viz` opens it; `bun ds:build` validates and builds it. Follow the existing Atlas/explorer conventions where they exist.

## Codegen

- `bun ds:gen` reads specs/design-system and writes:
  - TypeScript/SolidJS: tokens (CSS custom properties per theme + typed accessor), component prop types (`<Name>Props`), scaffolds per component with the anatomy, state classes, a11y attributes, keyboard handlers and test handles filled from the contract; hand-written parts live only in clearly marked non-generated modules the scaffold imports (no edits inside generated files).
  - SwiftUI: a `ProductUI` Swift package with `GZColor`, `GZSpace`, `GZFont`, `GZDuration` (asset catalog with light/dark), `enum <Name><Variant>` for each enum prop, a `protocol <Name>Contract` with the props as initializer requirements, and `struct <Name>: View` scaffolds with accessibility modifiers and identifiers from the contract.
- Generated files carry a header with the spec hash; CI fails if `bun ds:gen` produces a diff (generated code is committed and never edited).
- Use Style Dictionary 4 (DTCG-aware) for token outputs or a small in-house emitter; no third-party UI library.

## Conformance

- Tokens: a snapshot test per target resolves the compiled tokens into a flat map and asserts equality with the spec's resolved map for every theme.
- Contracts: TypeScript — generated `.d.ts` compared with the real exports (type-level test); Swift — compile-time conformance to the generated protocols.
- Behavior: every `.feature` runs in the Solid harness (@libs/harness-ts via @pkgs/gherkin) and in an XCTest target that parses the same files with the same step vocabulary. An unbound step reports UNKNOWN and fails.
- Accessibility: axe on every component state in Solid; XCTest performAccessibilityAudit in Swift; the contrast matrix check on tokens in CI.
- Visual: screenshots per component state per theme per breakpoint; the Solid build is the reference; Swift compares within a stated tolerance; results publish to the reports bucket like other spec kinds.
- Vocabulary lint over catalogs, prop names, component names, test ids.

## Repo rules you must keep

- Bun workspaces, flat `src/`, package categories and import boundaries (`package-boundaries.ts`), Tiger-Style size caps (no new `biome-ignore`), `data-testid` ships in every build, `data-component`/`data-screen` stripped in production, Solid props never destructured, styling via class/classList and tokens only.
- No brand, namespace or product names inside @pkgs/*.
- Commit in small reviewable steps: `spec:` commits for specs/design-system, then generator, then the swap in @pkgs/ui, then Swift. Each commit passes `bun verify`.

## Order of work

1. Inventory → EXTRACTION.md (do not write specs until the inventory is complete and counts 122).
2. Tokens (prove the token snapshot test passes against the existing CSS before touching components).
3. Contracts for all 122, category by category, with .feature and .md; registry/catalog check green.
4. Visualizer.
5. TypeScript codegen; swap @pkgs/ui to generated code; prove pixel parity with the visual corpus and that `bun verify` is green.
6. Swift codegen and its conformance target.
7. Only then: a separate PR proposing cleanups the extraction revealed (duplicated literals, inconsistent radii, a11y gaps), each as a spec change first.

Before step 1, write a short plan with the file layout and the exact commands you will add, and ask me only about decisions that cannot be undone (renames, deleting hand-written files). Everything else: decide, note it in EXTRACTION.md, and proceed.