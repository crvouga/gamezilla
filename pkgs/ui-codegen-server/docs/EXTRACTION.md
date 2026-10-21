# Design system extraction

The design system is being turned from code (`@pkgs/ui-root-client`,
`@pkgs/ui-root-shared`) into a specification that every implementation is
generated from and checked against. This file is the migration log: what has
been extracted from the code, what was decided along the way, and exactly what
remains. It describes the implementation, so it lives here, on the
implementation side, and never in the specification.

The mechanical facts — every registry entry, token, component, prop, state,
ARIA attribute, key, literal and stylesheet rule — are in
[INVENTORY.md](INVENTORY.md), generated from source by
`scripts/inventory.ts` (`bunx turbo run inventory --filter=@pkgs/ui-codegen-server`).
It is a snapshot of the commit it names: it describes the code before the swap
and is not regenerated once generated code replaces the hand-written
components.

## Dependency direction

The specification never couples to an implementation. Implementations depend
on the specification; the specification knows nothing about any of them.

- **The spec holds only its own vocabulary.** No package or module names, file
  paths, line numbers, language types (`JSX.Element`, `ComponentDataSet`,
  SwiftUI types), CSS custom properties, utility classes, DOM attributes
  (`data-*`, `aria-*`), or anything spelled for one platform. Accessibility is
  stated as role, name, states, actions and announcements; a test handle as an
  abstract handle name.
- **Everything that maps the spec onto a platform is implementation.** The
  per-target spellings of tokens, props, enums, slots, events, handles,
  accessibility names and states (the brief's "platform-mapping table"), any
  per-target extra props (the brief's `platform.<target>.extraProps`), and the
  generators live here in `@pkgs/ui-codegen-server`, never in the spec.
- **Conformance runs on the implementation side.** Each implementation's
  harness reads the spec and proves itself against it (token snapshot, prop
  types, behavior, accessibility, visuals). The spec has no test that reads an
  implementation.
- **The explorer registry is generated from the spec's registry**, never the
  reverse; its first content is extracted from today's `component-registry.ts`.
- **Enforced.** The spec package has no dependencies, and from step 2 a test
  inside it fails when a spec file mentions an implementation (package names,
  source paths and extensions, custom properties, DOM attributes, class names,
  language types).

## Where things live

| Part | Path | Side |
| --- | --- | --- |
| Behavior a business reader can follow (`<entry-id>.feature`) and the design-system vocabulary (`ubiquitous-language.yml`) | `specs/design-system/` | spec. `specs/README.md`: one flat directory per context, only `.feature` / `.qnt` / `.dmn` / `.als` / `.openslo.yaml` / `ubiquitous-language.yml`, every line readable by a business reader. |
| The machine-readable contract: DTCG tokens, `contract.yaml` per component, JSON Schemas, SVG icons, foundations, the registry, the catalog, `conformance.yaml` | `pkgs/ui-spec-shared/spec/` (created in step 2) | spec. Not admissible in `specs/` (nested folders, YAML / JSON / SVG / markdown); no dependencies. |
| This log, the inventory, the extractor, the platform mapping and the generators (`ds:gen`) | `pkgs/ui-codegen-server/` | implementation tooling: reads the spec, writes implementations. |
| Spec-driven visualizer | `pkgs/ui-spec-explorer-client/` | reads the spec only; its separate "live" tab embeds the generated Solid implementation for comparison. |
| Conformance harnesses | `@pkgs/ui-root-harness` (Solid), the Swift package's test target | implementation. |
| Swift package | `pkgs/ui-swift-client/` | implementation. Module `DesignSystemUI`, types `DSColor`, `DSSpace`, `DSFont`, `DSDuration`. |

## Decisions

Recorded 2026-10-21. Decisions the person running the refactor made are marked
_(asked)_; the rest were decided here and can be revisited.

1. _(asked)_ **Split home.** Behavior and vocabulary in `specs/design-system/`;
   the machine-readable contract in `pkgs/ui-spec-shared/spec/`. The rulebook is
   not amended.
2. _(asked)_ **Token source.** The uncommitted move of the token document from
   `design-system/design-tokens.json` into
   `pkgs/ui-root-shared/src/design-tokens.json` (and the removal of the old
   Swift projection) was committed first (`fac9fbac4`). The DTCG files of the
   spec replace that document as the source in step 2.
3. _(asked)_ **Deletion per component.** Each hand-written component file is
   deleted in the same commit that swaps in its generated replacement, once that
   component's pixel parity and `bun verify` are green.
4. _(asked)_ **Neutral Swift names** (`DesignSystemUI`, `DS*`) in `pkgs/`,
   because nothing in `pkgs/` names the product.
5. _(asked)_ **The spec never couples to an implementation**
   ([Dependency direction](#dependency-direction)). This moved this log and the
   inventory out of the spec package, turned the catalog check around (below),
   and keeps the brief's platform-mapping table, per-target extra props and
   `data-testid`-style test ids out of the contracts.
6. **The catalog is the spec's registry, not a number.** The brief said 122;
   today's registry holds **121** because `8cec5938b` deleted Toast. The spec's
   `registry.json` is extracted from it once; from then on the explorer registry
   is generated from the spec, and the implementation's conformance fails on any
   difference (id, title, category, order).
7. **One contract per registry entry**, in
   `components/<category-kebab>/<entry-id>/`, named in the spec's own
   vocabulary. Extraction takes today's names (`ScreenLargeTitle` for
   `screen-title`) so nothing is renamed; an entry that covers several
   components lists each as a part (see
   [Entries and components](#entries-and-components)).
8. **Repository naming wins over the brief's file names:** `themes.json` (not
   `$themes.json`), `GUIDANCE.md` per component (not `<Name>.md`), kebab-case
   folders, `<entry-id>.feature`. Swift's tool-mandated `Sources/` and `Tests/`
   join `NAMING_EXEMPT`.
9. **Generated code is committed** with a spec-hash header, and `ds:gen --check`
   fails on drift, as `tokens.css` and `token-names.ts` already are. This is a
   named exception to "derived output is gitignored": there is one generated file
   per component, so no hot shared file.
10. **No renames through step 6.** Every `@pkgs/ui-root-client/<module>` import
    path, component name, prop name and test id stays as it is. Cleanups are
    step 7, each a spec change first.
11. **Token emitters stay in-house**, extending `css-vars.ts` and
    `render-token-names.ts`; no Style Dictionary dependency.
12. **Enum order comes from the declaration.** The type checker lists union
    members in its own order (`"neutral" | "success" | "primary" | "danger"`
    for `ButtonIntent`); extraction takes the order written in source.
13. **The visual corpus is built before the swap.** None exists today (the
    only raster check is the chess board's `visual.contract.test.ts`). Every
    example state × theme × breakpoint renders through
    `@pkgs/ui-testing-bun-webview`. The baseline comes from the commit before
    each swap and the candidate from the swap, in the same job, and they must be
    pixel-equal. No PNGs are committed; nightly publishes to the reports bucket.
14. **The vocabulary lint ships with its current violations recorded** as gaps
    (for example `user` or `session` in a prop or test id), cleared in step 7,
    so steps 1–6 rename nothing.
15. **Swift CI needs macOS.** Every workflow job runs on `ubuntu-24.04`, and
    SwiftUI and `performAccessibilityAudit` only run on macOS. Adding a macOS
    runner is confirmed with the person running the refactor at step 6, before
    it is added.
16. **Icons.** The 83 Lucide icons pass through the one boundary `icons.ts`
    (`lucide-solid` ^1.60.0, ISC licence); the 3 brand logos (`google`, `apple`,
    `dev`) are in-house SVG in `brand-logos.tsx`. Step 2 exports each as an SVG
    into the spec. `BrandIcon`'s contract enumerates the brand names; `Icon`'s
    enumerates the Lucide set.

## Counts

From [INVENTORY.md](INVENTORY.md#counts) at `c5efa175e`.

| What | Count | Note |
| --- | --- | --- |
| Registry entries | 121 | 122 in the brief; Toast deleted in `8cec5938b` |
| Explorer categories | 12 | Foundation, Brand, Layout, Icons, Inputs, Primitives, Games, Data Display, Feedback, Disclosure, Overlay, Screen Layouts |
| Component modules (export a component or set `data-component`) | 228 | |
| Modules no registry example imports | 80 | parts, providers, hooks' hosts; each gets a home in a contract's anatomy or is listed as internal in step 3 |
| Exported components | 370 | |
| Distinct `data-component` names | 158 | matches a plain `grep` of `component: '<Name>'` |
| Own props (not inherited from DOM types) | 2,421 | |
| Tokens in the token document | 173 | 35 color roles × light and dark, plus scales |
| Custom properties in `tokens.css` | 249 | across `:root` and the scheme blocks |
| Literals in source | 930 | see [Promoted literals](#promoted-literals) |
| Stylesheet rules | 267 | |
| Lucide icons / brand logos | 83 / 3 | |

Entries per category, in registry order (categories recur because the five
`registry-entries-*.ts` modules each add to several):

| Category | Entries |
| --- | --- |
| Foundation | 1 |
| Brand | 1 |
| Layout | 16 |
| Icons | 1 |
| Inputs | 30 |
| Primitives | 23 |
| Games | 1 |
| Data Display | 15 |
| Feedback | 12 |
| Disclosure | 2 |
| Overlay | 6 |
| Screen Layouts | 13 |
| **Total** | **121** |

## Entries and components

The registry lists explorer pages, not components, so 21 entries are not one
component whose name is the PascalCase of the id.

**No single component** (contract `name` is the PascalCase of the id; the
components are its parts):

| # | Entry | Covers |
| --- | --- | --- |
| 1 | `theme-tokens` "Theme Tokens" | a foundation page (`scheme-preview`, `theme-context`); its contract points at the token spec rather than a component |
| 10 | `catalog` | `CatalogList`, `CatalogDetail` |
| 50 | `element-handles` "Focus, scroll and measure" | the `focus`, `scroll` and `measure` handles over `Pressable`, `ScrollView`, `TextInput` |
| 51 | `game-arena` "Game Arena" | the `game-*` parts (`GameActionButton`, `GameBoardStage`, `GameChoiceGrid`, `GameClock`, `GameCountdown`, `GameDisclosure`, `GamePlayerBar`, `GameScreen`, `GameSearchState`, `GameSection`, `GameStat`, `GameStatus`, `ScreenIntro`) |
| 79 | `modal` | `ModalRoot`, `ModalContent`, `ModalHeader`, `ModalBody`, `ModalFooter`, `ModalButton`, `ConfirmationModal` |

**Title is not the component name** (contract `name` is the component, the
title is kept as the explorer label):

| # | Entry id | Title | Component |
| --- | --- | --- | --- |
| 5 | `screen-title` | ScreenLargeTitle | `ScreenLargeTitle` (module `screen-large-title`) |
| 35 | `multi-select-swatch` | MultiSelectSwatchGrid | `MultiSelectSwatchGrid` |
| 47 | `semantic-list` | Semantic lists | the module's list components |
| 70 | `dismissible-top-banner` | DismissibleBanner | `DismissibleBanner` |
| 110 | `mini-player` | MiniPlayerDock | `MiniPlayerDock` |
| 83–95 | the 13 Screen Layouts | prose titles ("Main menu", "Custom game", …) | the module's layout component (`MainMenuScreen`, `GameScreen`, `GameSessionLayout`, `GameSetupPanel`, `PuzzleScreen`, `GameHistoryScreen`, `GameReviewScreen`, `FormScreen`, `MenuScreen`, `ProfileScreenLayout`, `CollectionScreen`, `ContentScreen`, `EmbeddedScreen`) |

Entries 46 `landmarks` and 47 `semantic-list` each export several components
from one module; their contracts list each as a part.

## Tokens

The token document has 173 leaves. The values the shipped CSS uses but the
document does not hold are written in `theme.css` and become core tokens in
step 2:

- the four breakpoints written out for media queries (`640px`, `768px`,
  `1024px`, `1280px`, held equal to `breakpoint.*` by
  `theme-artifacts.test.ts`);
- `--leading-none: 1`;
- the system colors `Canvas` / `CanvasText` and the keywords `transparent`,
  `currentColor`, `inherit` (keywords, recorded but not promoted);
- Tailwind's stock `--spacing` (`0.25rem`), which the theme does not clear and
  which every numeric utility (`w-12`, `h-7`, `min-h-11`) multiplies.

## Promoted literals

Every visual value written in source instead of read from a token becomes a
core token in step 2, with a `$description` naming where it is used.
[INVENTORY.md](INVENTORY.md#literals-in-source) lists each occurrence with file,
line and context. Summary:

| Kind | Occurrences | Distinct | Notes |
| --- | --- | --- | --- |
| color | 43 | 32 | 23 vendor sign-in button colors (`social-provider-config.tsx`), 6 brand-logo fills (`brand-logos.tsx`); 14 are in color math (`contrast.ts`, `css-color.ts`, `design-tokens.ts`), not paint, and are triaged rather than promoted |
| length | 115 | 36 | `100%` ×31, hairlines `1px` ×17 and `2px` ×11, the breakpoints written out in `theme.css`, game and board geometry (`game-ui.module.css`, `disc-drop-board.module.css`), `deg` angles |
| duration | 2 | 2 | `1000ms` activity revolution, `1.2s` skeleton pulse |
| z-index | 1 | 1 | panel hairline `z-index: 1` |
| font | 5 | 5 | letter-spacing `-0.01em`, `-0.02em`, `-0.03em`, `inherit`; `line-height: 1` |
| easing | 1 | 1 | `steps(12, end)` |
| opacity | 13 | 3 | `0`, `0.55`, `1` |
| grid utility | 629 | 160 | Tailwind numeric steps on the 4px grid (`w-12` = 48px) |
| numeric constant | 121 | 116 | TypeScript constants; to be split in step 2 into visual (sizes, durations → tokens) and behavioral (timeouts, counts, ratios → contract props or kept) |

The per-literal promotion table (literal → new token path) is filled in step 2.

## Gaps

Places where the code lacks something the spec format requires. A gap is
recorded, never filled by invented behavior.

- **Five entries have no single component** (above); their contracts describe
  parts.
- Accessible names, keyboard maps and announcements per component: the
  inventory lists every ARIA attribute, role, DOM event and compared key per
  module, but tying keys to actions and judging whether each part has an
  accessible name needs each handler read. This is done per contract in step
  3, and each missing piece is listed here as it is found.

## Checklist

### Step 1 — inventory

- [x] Registry: 121 entries with id, title, category, order and the modules
      each example imports.
- [x] Tokens: all 173 leaves with exact values in both schemes, and the 249
      compiled custom properties.
- [x] Components: 370 exported components in 228 modules, with every own prop
      (type, enum members, optional, default, doc).
- [x] States: every `classList` branch, and every `data-*` hook (from JSX,
      `dataAttrs({ … })` and `dataSet={{ … }}`).
- [x] Accessibility attributes: roles, `aria-*`, `tabIndex` per element.
- [x] Events: DOM handlers per element; prop callbacks (`on*`) in the prop
      tables.
- [x] Keys compared per module and by the logic modules each imports;
      document-level key listeners counted.
- [x] Test ids from `data-testid`, `testId` and `dataSet.testid`.
- [x] Literals: 930 occurrences across colors, lengths, durations, z-indexes,
      fonts, easings, opacities, grid steps and numeric constants.
- [x] Stylesheet rules: 267 rules with their at-rule context.
- [x] Explorer categories and order.
- [x] Icons: 83 Lucide + 3 brand logos.

Not covered by the mechanical inventory, carried into step 3: keys tied to the
actions they cause, the token each state paints with (from
[Stylesheet rules](INVENTORY.md#stylesheet-rules) and the utility classes),
slot and event classification into the contract type language, and accessible
name gaps.

### Step 2 — tokens

- [ ] `spec/tokens/core.json`, `semantic.light.json`, `semantic.dark.json`,
      `typography.json`, `themes.json` (dark default).
- [ ] Promoted literals → core tokens, with the promotion table above.
- [ ] Token snapshot test (implementation side): the compiled CSS resolves to
      the spec's resolved map in every theme, before any component changes.
- [ ] Spec-purity test in the spec package: no spec file mentions an
      implementation.
- [ ] Contrast matrix check in CI.

### Step 3 — contracts (121)

- [ ] JSON Schema for `contract.yaml` and `registry.json`.
- [ ] `registry.json` extracted once from `component-registry.ts`;
      `CATALOG.md` / `catalog.json` generated from the spec; the explorer
      registry generated from the spec, checked implementation-side.
- [ ] Per category: `contract.yaml`, `GUIDANCE.md`, `specs/design-system/<entry-id>.feature`.
      Foundation 0/1 · Brand 0/1 · Layout 0/16 · Icons 0/1 · Inputs 0/30 ·
      Primitives 0/23 · Games 0/1 · Data Display 0/15 · Feedback 0/12 ·
      Disclosure 0/2 · Overlay 0/6 · Screen Layouts 0/13.
- [ ] Foundations markdown; vocabulary spec and lint.

### Step 4 — visualizer

- [ ] `bun ds:viz`, `bun ds:build`.

### Step 5 — TypeScript codegen and swap

- [ ] Visual corpus baseline.
- [ ] `bun ds:gen`; per-component swap with parity: 0/121.

### Step 6 — Swift

- [ ] macOS runner confirmed; `DesignSystemUI` package and conformance target.

### Step 7 — cleanups

- [ ] A separate pull request of spec changes for what the extraction revealed.
