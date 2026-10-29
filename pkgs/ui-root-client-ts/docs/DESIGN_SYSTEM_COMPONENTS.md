# Design system component list

Every component the product's design system needs, grouped by Atomic Design
level (the composition law in [`../README.md`](../README.md#composition)).

This list was built from what the product actually paints today: the 129
explorer entries in `src/registry-entries-*.ts`, the modules in `src/` that
have no explorer entry yet, and what each client lib in `libs/*-client-ts`
imports. It is not a wishlist.

**Status key**

| Mark | Meaning |
| --- | --- |
| ✅ | Built and listed in the component explorer |
| 🟡 | Built and used by the product, but **no explorer entry / example** yet |
| 🆕 | Not built. A candidate, only if a screen needs it |

Tokens (color, type, space, radius, shadow, motion, breakpoints) are the layer
under every component. They live in
`pkgs/ui-root-shared-ts/src/design-tokens.json` and are not repeated here.

---

## 0. Foundations (not components, but the system needs them)

| Item | Status | Notes |
| --- | --- | --- |
| Theme tokens (light / dark / true black) | ✅ | `Theme Tokens` entry; generated `tokens.css` |
| Theme provider + preference (system / light / dark) | 🟡 | `theme-context`, `theme-preference`, `scheme-preview` |
| Type roles (`body`, `bodyBold`, `label`, `caption`, `footnote`, `mono`, `numeral`) | ✅ | via `Text`, `Heading` |
| Spacing, radius, shadow, motion scales | ✅ | in tokens |
| Layout mode / breakpoint hooks | 🟡 | `use-layout-mode`, `responsive`, `media-query` |
| Reduced-motion handling | 🟡 | tokens + `fade-switch` |
| Icon set | ✅ | `Icon`, `BrandIcon` (see Atoms) |
| Focus management (`focus-trap`, focus ring, scroll, measure) | ✅ | `Focus, scroll and measure` |

---

## 1. Atoms

### Layout primitives

| Component | Status |
| --- | --- |
| Stack (`StackV` / `StackH`) | ✅ |
| Grid | ✅ |
| Layer (z-stacking) | ✅ |
| Spacer | ✅ |
| Divider | ✅ |
| Surface (the one paint primitive) | ✅ |
| ScrollView | ✅ |
| Pane | ✅ |
| Passthrough / LayoutHost (slot helpers) | 🟡 |

### Text and content

| Component | Status |
| --- | --- |
| Text (`P`) | ✅ |
| Heading (`H1`–`H6`) | ✅ |
| TextLink | ✅ |
| ExternalUrl | 🟡 |
| FieldLabel | ✅ |
| CodeBlock | ✅ |
| LogLine | ✅ |
| HighlightedText (search match highlight) | 🟡 |
| MarkdownContent (safe markdown render) | 🟡 |
| RelativeTime ("2 min ago") | 🟡 |
| VisuallyHidden | ✅ |
| ChromeTitle | ✅ |

### Imagery and icons

| Component | Status |
| --- | --- |
| Icon | ✅ |
| BrandIcon | ✅ |
| BrandLogos (social providers) | 🟡 |
| AppLogo | ✅ |
| Image | ✅ |
| BadgedIcon | ✅ |
| StatusIconSlot | ✅ |
| Sparkline | ✅ |

### Identity

| Component | Status | Notes |
| --- | --- | --- |
| Avatar | ✅ | Person placeholder, never an icon in a ring |
| SpeakingAvatar | ✅ | Voice-activity ring |

### Status and feedback marks

| Component | Status |
| --- | --- |
| Spinner (the one activity indicator) | ✅ |
| Skeleton | ✅ |
| ProgressBar | ✅ |
| StatusDot | ✅ |
| Badge | ✅ |
| SoundIndicator / AnimatedSpeakerWaves | ✅ / 🟡 |
| TypingDots | 🟡 |
| SpectatorIndicator | 🟡 |

### Buttons and links

| Component | Status |
| --- | --- |
| Button (solid / outline / ghost / destructive, loading face) | ✅ |
| IconButton | ✅ |
| BackIconButton / CloseIconButton | 🟡 |
| IconLink | ✅ |
| FloatingActionButton | ✅ |
| SocialSignInButton | ✅ |
| FileTrigger | ✅ |
| Pressable (unstyled press target) | ✅ |
| GameActionButton (async, double-submit safe) | 🟡 |

### Form controls

| Component | Status |
| --- | --- |
| TextInput | ✅ |
| Textarea | ✅ |
| Checkbox | ✅ |
| Switch | ✅ |
| RadioGroup | ✅ |
| Select | ✅ |
| NumberStepper | ✅ |
| RangeControl (slider) | ✅ |
| Tooltip | ✅ |

---

## 2. Molecules

| Component | Status | Notes |
| --- | --- | --- |
| Chip / ChipGroup | ✅ | Selected chip is the blue fill |
| SegmentedControl | ✅ | |
| FormField (label + control + hint + error) | ✅ | |
| CopyToClipboardField | ✅ | |
| Combobox | ✅ | with chips, list, search, trigger parts |
| MultiSelectSwatchGrid | ✅ | |
| SuggestionList | ✅ | |
| PickerSection | ✅ | |
| MenuRow | ✅ | The row inside a `MenuSection` |
| MainMenuItemRow | 🟡 | Destination row |
| AvatarGroup / AvatarHero | ✅ | |
| PaginationControls | ✅ | |
| FilterBar | ✅ | |
| MetricStrip | ✅ | |
| Notice (inline, dismissible) | ✅ | The only way to report an outcome — no toast |
| ActionNotice | 🟡 | |
| OverflowMenuButton | ✅ | |
| FloatingMenu | 🟡 | Anchored menu |
| FloatingTooltip | 🟡 | |
| Popover | ✅ | |
| Collapsible | ✅ | |
| SpeechBubble | 🟡 | Chat message |
| Breadcrumb trail | 🟡 | `screen-breadcrumb-trail` |
| ArrowKeyGroup (roving keyboard focus) | ✅ | |
| Command palette parts (Row, Section, Kbd, Hint, Empty) | 🟡 | |
| Editor toolbar / link form / suggestion menu | 🟡 | Parts of `MarkdownEditor` |

---

## 3. Organisms

### Navigation and chrome

| Component | Status |
| --- | --- |
| TopBar (+ TopBarTitle) | 🟡 |
| AppHeaderIsland | ✅ |
| TabBar | ✅ |
| Tabs | ✅ |
| ActionBar | ✅ |
| BottomActionBar | ✅ |
| Toolbar | ✅ |
| AppFrame | ✅ |
| FormActionsFooter | ✅ |
| DismissibleTopBanner (system-level only, never an action outcome) | ✅ |
| MiniPlayerDock | ✅ |
| CommandPalette | ✅ |

### Lists, tables, panels

| Component | Status |
| --- | --- |
| MenuSection / MenuList (the "list is a panel" rule) | 🟡 |
| List | ✅ |
| SemanticList | ✅ |
| VirtualList | 🟡 |
| Table | ✅ |
| Card | ✅ |
| DocumentPanel | ✅ |
| PairedPanels | 🟡 |
| Catalog (list + detail) | ✅ |
| ExplorerWorkspace | ✅ |
| InspectionWorkspace | ✅ |
| ActivityRegion | ✅ |

### Overlays

| Component | Status |
| --- | --- |
| Modal | ✅ |
| ConfirmationModal | 🟡 |
| MutationModal (pending → success → retryable error) | ✅ |
| ResponsiveSurface (modal on wide, sheet on narrow) | ✅ |
| WebBottomSheet | 🟡 |
| FloatingPanel | ✅ |

### Forms and editors

| Component | Status |
| --- | --- |
| Form | ✅ |
| MarkdownEditor | ✅ |
| CodeEditor | ✅ |
| EmbeddedFrame | ✅ |

### Page states

| Component | Status |
| --- | --- |
| LoadingState | ✅ |
| EmptyState | ✅ |
| ErrorState (always has a next action) | ✅ |
| SuccessState | ✅ |
| StateBlock (shared shell) | 🟡 |

These four are required by
[`docs/SELF_SERVICE_READINESS.md`](../../../docs/SELF_SERVICE_READINESS.md):
distinct loading / empty / failure states on every person-facing screen.

---

## 4. Game components

The product's differentiator. Each game imports one of these boards.

### Boards and play surfaces

| Component | Status | Used by |
| --- | --- | --- |
| Chess board (`@pkgs/chess-board-root-client-ts`) | sibling package | Chess, puzzles |
| CellGridBoard | ✅ | Quoridor, Battleship, Sokoban |
| TileBoard | ✅ | Sokoban |
| PathGridBoard | ✅ | Numberlink |
| WordTileBoard + TileRack | ✅ / 🟡 | Word tiles |
| DiscDropBoard | 🟡 | Connect Four |
| CardTable | ✅ | Hearts |
| TrailArena + DirectionPad | ✅ | Light Cycles |
| PaddleCourt | ✅ | Pong |
| BoardFit (scale a board to its container) | ✅ | All |
| MoveStrip (move list) | ✅ | Chess |
| Game Arena (reference composition) | ✅ | Explorer |

### Game chrome

| Component | Status |
| --- | --- |
| GamePlayerBar (seat: avatar, name, badges, clock) | 🟡 |
| GameBoardStage (far seat / board / near seat) | 🟡 |
| GameClock | 🟡 |
| GameCountdown | 🟡 |
| GameStatus (whose turn / how it ended) | 🟡 |
| GameStat | 🟡 |
| GameSection | 🟡 |
| GameChoiceGrid | 🟡 |
| GameDisclosure | 🟡 |
| GameSearchState (matchmaking) | 🟡 |
| GameSetupPanel | ✅ |
| GameSessionLayout | ✅ |

---

## 5. Templates (screen families)

Every page is `ScreenBase` **or** `EmbeddedScreen`, never both.

| Template | Status | Archetype |
| --- | --- | --- |
| ScreenBase (+ ScreenLargeTitle) | ✅ | Routed screen that owns the viewport |
| EmbeddedScreen (+ ScreenIntro) | ✅ | Screen inside a host's chrome |
| MainMenuScreen | ✅ | Embedded |
| MenuScreen (settings menu) | ✅ | ScreenBase |
| FormScreen | ✅ | ScreenBase |
| ContentScreen (details and documents) | ✅ | ScreenBase |
| CollectionScreen (search and collections) | ✅ | ScreenBase |
| ProfileScreenLayout | ✅ | ScreenBase |
| GameScreen | ✅ | Embedded |
| PuzzleScreen | ✅ | Embedded |
| GameHistoryScreen | ✅ | Embedded |
| GameReviewScreen | ✅ | Embedded |

---

## 6. Candidates not built yet 🆕

Add one only when a spec in `specs/` needs it. Per the README rule, a one-off
in a screen is a *missing atom*, so these are the likely ones.

| Candidate | Why it might be needed |
| --- | --- |
| Toast / Snackbar | **Do not build.** Banned by rule 11; `tests/no-toast.test.ts` enforces it |
| DatePicker / TimePicker | Only if scheduled games or puzzle-of-the-day filters need it |
| Stepper / Wizard progress | Multi-step game setup or onboarding |
| Rating / Elo display (`numeral` + delta) | Leaderboards, profile, post-game review |
| Leaderboard row | Ratings and friends lists |
| Empty-board / board skeleton | Self-service "loading" state for boards |
| Reaction / emoji picker | Only if chat gains reactions |
| Pull-to-refresh | Native (Capacitor) wrappers, if polling is ever needed |

---

## Summary

| Level | Components |
| --- | --- |
| Atoms | ~50 |
| Molecules | ~25 |
| Organisms | ~35 |
| Games | ~25 |
| Templates | 12 |

About **30 built modules have no explorer entry** (🟡). Giving each an
`*.example.tsx` and a `registry-entries-*.ts` line is the cheapest way to make
the design system's coverage honest before adding anything new.
