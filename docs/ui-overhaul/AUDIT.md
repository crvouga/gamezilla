# UI overhaul — Phase 0 audit

Snapshot of `feat/ui-overhaul-design-system` at `df570655c` (2026-10-28).
It covers the inventory, the gaps against the target brief, and an old→new
map. Paths are relative to the repo root. `ui/` is short for
`pkgs/ui-root-client-ts/src/`.

## Findings that change the plan

1. **The brief's `GameDefinition` name is already taken.** `GameDefinition`
   in `libs/spaces-shared-ts/src/game.ts:137` is the room-level registration.
   The game-facing contract is split across `defineGame`
   (`libs/game-session-shared-ts/src/game-definition.ts:210`) and
   `defineGameClient` (`libs/game-menu-client-ts/src/game-client.tsx:183`).
   `defineTurnGame` exists only in docs: AGENTS.md, GAME_FRAMEWORK.md and
   ADDING_A_GAME.md still name it, but no code defines it.
2. **Seats are capped at 2–4.** `GAME_SIDES = ['white','black','red','blue']`
   and `assertGameSides` (`pkgs/turn-game-shared-ts/src/game-rules.ts:5,296`)
   enforce it. A player count is not a parameter. Each count is a separate
   registered mode: Light Cycles Duel/Trio/Quad, Word Tiles 2/3/4, and
   Quoridor classic (2) / hill (4). Solo games are puzzle content with no
   seats. The brief's range of 1–8 players needs a contract change.
3. **No game supplies per-seat color, an action list, a turn string or
   standings.** Six of eleven games paint their own status line, scoreboard,
   player list or action bar *inside their `Board`* (§4).
4. **Toast is banned.** `ui-root-client-ts/README.md` rule 11 forbids it and
   `pkgs/ui-root-client-ts/tests/no-toast.test.ts` enforces the ban. The
   brief's Toast needs a README and test change in a `spec:`/design decision
   first.
5. **The palette is light/dark with `system` as the default**
   (`ui/theme-preference.tsx:45`). It uses one font (the system stack), type
   sizes 12/14/16/20/24/32 and radii 4/8/12. Every target value differs (§3).
6. **Hard-coded values are rare.** The lint (`design-vocabulary.ts`) keeps
   them out. The real drift is:
   - off-token numeric icon sizes (`size={18}`, `size={28}`);
   - about 665 numeric Tailwind spacing steps, against 55 named-token steps;
   - fixed board colors in the chess board theme.

---

## 1. Routes and screens

There is one router: `@solidjs/router`, built in
`libs/app-root-client-ts/src/routes.tsx`. `buildRouteTable` concatenates
three sources: the routes each sub contributes through `defineSubClient`
(composed in `libs/runtime-client-ts/src/app-sub-clients.ts`), the shell's
`SHELL_ROUTE_TABLE` (`libs/app-root-client-ts/src/route-table.ts`), and the
not-found route `/*all`. Tab roots (`tab: true`) nest under `TabsLayout`
(`libs/app-root-client-ts/src/tabs-layout.tsx`: `StackVertical` +
`AppTabBar`).

### 1a. URL routes

| Path | Screen component → body file | Template |
| --- | --- | --- |
| `/` (tab) | `SpacesScreen` `libs/spaces-client-ts/src/spaces.tsx` → `spaces-screen.tsx` | CollectionScreen |
| `/space/:id` | `SpaceScreen` `libs/spaces-client-ts/src/space.tsx` → `space-detail-screen.tsx` → `active-space.tsx` / `space-active-layout.tsx` | Custom chrome: `TopBar` (compact) or `AppHeaderIsland` (wide), hosting in-space EmbeddedScreens (§1b). States: `space-join-prompt.tsx`, `space-ended-screen.tsx`, `space-reachability.tsx` → ContentScreen |
| `/search` (tab) | `libs/search-client-ts/src/search.tsx` → `search-screen-view.tsx` | CollectionScreen |
| `/profile` (tab) | `libs/profile-client-ts/src/profile.tsx` → `profile-screen.tsx` | ProfileScreenLayout |
| `/profile/edit` | `profile-edit.tsx` → `profile-edit-screen.tsx` | MenuScreen |
| `/profile/handle` | `profile-handle.tsx` → `profile-handle-screen.tsx` | FormScreen |
| `/profile/avatar` | `profile-avatar.tsx` → `avatar-editor-screen.tsx` | FormScreen |
| `/profile/privacy`, `/profile/privacy/export/:accountId` | `libs/account-privacy-client-ts/src/privacy-screen.tsx` → `privacy-screen-layout.tsx` | ContentScreen |
| `/profile/friends` | `libs/friends-client-ts/src/profile-friends.tsx` → `friends-list-screen-view.tsx` | CollectionScreen (gate: ContentScreen) |
| `/profile/user/:userId` | `friend-user.tsx` → `friend-user-screen-view.tsx` | ProfileScreenLayout |
| `/notifications` (tab) | `libs/notifications-client-ts/src/notifications.tsx` → `notifications-screen.tsx` | CollectionScreen |
| `/more` | `libs/app-root-client-ts/src/more.tsx` → `settings-screen.tsx` | MenuScreen |
| `/more/theme` · `/performance` · `/sound` · `/about` · `/sync` | `more-*.tsx` → `theme-screen` / `performance-screen` / `sound-screen` / `about-screen` / `sync-screen.tsx` (app-root) | MenuScreen |
| `/more/server-status` | `more-server-status.tsx` | MenuScreen |
| `/more/client-config` | `libs/app-config-client-ts/src/client-config-screen.tsx` | MenuScreen |
| `/more/account` | `libs/auth-client-ts/src/account-screen.tsx` | MenuScreen |
| `/more/account/providers` | `account-providers.tsx` → `route-stub.tsx` | ContentScreen |
| `/more/account/devices` | `libs/auth-client-ts/src/account-devices-screen.tsx` | MenuScreen |
| `/more/account/device/:deviceId` | `libs/auth-client-ts/src/account-device-detail-screen.tsx` | MenuScreen |
| `/more/billing` | `libs/billing-client-ts/src/billing-screen.tsx` → `billing-screen-view.tsx` | ContentScreen |
| `/more/puzzles` | `libs/chess-puzzle-client-ts/src/puzzle-management-screen.tsx` (registered in `app-sub-clients.ts:45`) | ContentScreen, or EmbeddedScreen when embedded |
| `/more/<game>-stats` (chess only today) | `libs/game-menu-client-ts/src/personal-puzzle-stats-clients.tsx` → `libs/game-puzzle-client-ts/src/personal-puzzle-stats-screen.tsx` | ContentScreen wrapping GameHistoryScreen / GameReviewScreen |
| `/chess/puzzle/:puzzleId` | `libs/game-puzzle-client-ts/src/puzzle-link-client.ts` → `puzzle-link-screen.tsx` | ContentScreen |
| `/:gameId/multiplayer` | `libs/game-matchmaking-client-ts/src/multiplayer-link-client.tsx` → `multiplayer-link-screen.tsx` | ContentScreen |
| `/admin/synthetic-population` · `/config` · `/users/:id` | `libs/synthetic-population-client-ts/src/synthetic-population-screen.tsx`, `synthetic-user-screen.tsx` (lazy) | ContentScreen |
| `/client/sql` | `libs/app-root-client-ts/src/client-sql.tsx` | ScreenBase (raw) |
| `/client/events` | `client-events.tsx` | ContentScreen |
| `/ui`, `/ui/:component` | `ui-explorer.tsx`, `ui-explorer-detail.tsx` | ExplorerList / ExplorerDetail |
| `/sso-callback` | `sso-callback.tsx` | none (`Surface` + `LoadingState`) |
| `/*all` | `not-found.tsx` → `route-stub.tsx` | ContentScreen |

`apps/client-ts` and `apps/product-ts` declare no routes of their own.

### 1b. In-space screens (keyed by `useGameScreen()`, not URLs)

| Screen key | Component → file | Template |
| --- | --- | --- |
| (no game chosen) | `GamesMainMenu` `libs/spaces-client-ts/src/games-main-menu.tsx` | MainMenuScreen |
| game choices | `GameMenu` `libs/game-menu-client-ts/src/game-menu.tsx`, with the choices built in `game-menu-choices.tsx` | MainMenuScreen |
| `custom-game` | `CustomGameScreen` `libs/game-session-client-ts/src/custom-game-screen.tsx` | GameScreen + GameSessionLayout + GameBoardStage |
| `multiplayer` | `MultiplayerScreen` `libs/game-matchmaking-client-ts/src/multiplayer-screen.tsx` | GameScreen + GameSessionLayout + GameBoardStage |
| `history` | `GameHistory` `libs/game-session-client-ts/src/game-history.tsx` | GameHistoryScreen / GameReviewScreen |
| `puzzle` | `PuzzlePlayScreen` → `libs/game-puzzle-client-ts/src/puzzle-play-layout.tsx` | PuzzleScreen |
| `stats` / `stats-review` | `puzzle-stats-screen.tsx` → `puzzle-stats-body.tsx`; `puzzle-review-screen.tsx` | GameHistoryScreen; GameReviewScreen |
| `puzzle-library` | `ContentExperience` → `content-library-screen.tsx`; `content-attempt-screen.tsx`, `content-author-screen.tsx`, `content-edition-screen.tsx` | EmbeddedScreen; GameScreen + GameSessionLayout |
| `settings` (chess) | `libs/chess-shared-client-ts/src/chess-settings-screen.tsx` and the developer screens | MainMenuScreen; ExplorerList / ExplorerDetail |

---

## 2. Components (`ui/`)

The package holds 239 non-example `.tsx` modules, 66 `.ts` helpers and 129
`*.example.tsx` files. Examples are registered in
`ui/registry-entries-{core,display,primitives,additions,screens}.ts`
(35 + 37 + 15 + 29 + 13 entries).

| Group | Modules |
| --- | --- |
| Layout | `stack` (Stack, StackVertical, StackHorizontal), `grid`, `layer`, `surface`, `card`, `divider`, `spacer`, `pane`, `scroll-view`, `screen-column`, `content-edge-padding`, `layout-host`, `board-fit`, `landmarks`, `mount`, `passthrough` |
| Text | `text` (P, Text, Strong, Em, Code, Time), `heading` (H1–H6), `highlighted-text`, `markdown-content`, `code-block`, `log-line`, `relative-time`, `visually-hidden`, `text-link`, `external-url` |
| Icon / imagery | `icon` (Icon), `icons.ts` (78 glyphs), `create-icon`, `badged-icon`, `brand-icon`, `brand-logos`, `app-logo`, `image`, `sparkline`, `typing-dots`, `sound-indicator`, `animated-speaker-waves` |
| Identity | `avatar`, `avatar-group`, `avatar-hero`, `speaking-avatar`, `spectator-indicator`, `status-dot`, `speech-bubble` |
| Buttons | `button` (+`button-parts`), `icon-button`, `back-icon-button`, `close-icon-button`, `action-bar-icon-button`, `icon-link`, `floating-action-button`, `overflow-menu-button`, `pressable`, `social-sign-in-button`, `copy-to-clipboard-field`, `file-trigger` |
| Form controls | `text-input`, `textarea`, `select` (+trigger/options), `combobox` (+6 parts), `checkbox`, `switch`, `radio-group`, `segmented-control`, `chip`, `chip-group`, `number-stepper`, `range-control`, `file-picker`, `form`, `form-field`, `field-label`, `multi-select-swatch-grid`, `direction-pad`, `arrow-key-group`, `code-editor`, `markdown-editor`, `editor-toolbar`, `editor-link-form`, `editor-suggestion-menu`, `suggestion-list`, `picker-section` |
| Lists | `menu-row`, `menu-section`, `menu-list`, `main-menu-item-row`, `list` (List, ListItem), `semantic-list`, `catalog-list` (+rows/search/detail/nav), `table`, `virtual-list`, `pagination-controls`, `metric-strip`, `filter-bar` |
| Feedback / states | `notice`, `action-notice`, `empty-state`, `error-state`, `loading-state`, `success-state`, `state-block`, `skeleton`, `spinner`, `progress-bar`, `badge`, `tooltip`, `floating-tooltip`, `dismissible-top-banner`, `activity-region`, `status-icon-slot` |
| Overlays | `modal-root`, `modal-content`, `modal-parts`, `modal-backdrop`, `confirmation-modal`, `mutation-modal` (+parts), `responsive-surface`, `web-bottom-sheet`, `popover`, `floating-menu`, `floating-panel`, `command-palette` (+9 parts), `overlay-portal`, `focus-trap`, `collapsible` |
| Chrome / nav | `app-frame`, `app-frame-chrome`, `app-header-island`, `top-bar`, `top-bar-title`, `chrome-title`, `tab-bar`, `tabs`, `toolbar`, `action-bar` (+parts), `bottom-action-bar` (+parts), `screen-breadcrumb-trail`, `mini-player`, `embedded-frame`, `app-router`, `pending-navigation-provider` |
| Templates | `screen-base` (+compact/wide/header/primary-action), `embedded-screen`, `screen-intro`, `screen-large-title`, `main-menu-screen`, `menu-screen`, `form-screen`, `form-actions-footer`, `content-screen`, `collection-screen`, `profile-screen-layout`, `game-screen` (GameScreen, GameLayout), `game-session-layout`, `puzzle-screen`, `game-history-screen`, `game-review-screen`, `explorer-*`, `inspection-workspace`, `document-panel` |
| Game chrome | `game-player-bar`, `game-board-stage`, `game-status`, `game-stat`, `game-section` (GameSection, GameActions), `game-setup-panel`, `game-action-button`, `game-choice-grid`, `game-disclosure`, `game-clock`, `game-countdown`, `game-search-state` |
| Boards | `cell-grid-board`, `tile-board`, `path-grid-board`, `word-tile-board`, `tile-rack`, `disc-drop-board`, `card-table`, `trail-arena`, `paddle-court`, `paired-panels`, `move-strip`; chess lives in `pkgs/chess-board-root-client-ts` |
| Infra / context | `theme-context`, `theme-preference`, `scheme-preview`, `surface-stack`, `on-color-context`, `spinner-context`, `compose-providers`, `command-registry-context`, `register-command`, `keyboard-shortcut-scope`, `use-mutation-button`, `mutation-success-hold`, `fade-switch`, `screen-focus`, `screen-title-context`, `test-command-probe`, `test-viewport`, `example-*`, `screen-example-*` |

### 2a. Main components: props and variants

| Component | Props (closed) |
| --- | --- |
| `Button` | `intent` primary\|danger\|success\|neutral × `variant` solid\|outline\|ghost × `size` sm\|md\|lg (heights 32/44/52). Also `title`, `icon`/`startIcon`/`endIcon`, `loading`, `feedback` idle\|loading\|success\|error, `loadingLabel`/`successLabel`/`errorLabel`, `onRetry`, `fullWidth`, `flex`, `type` |
| `IconButton` | `label`, `children`, `variant` icon\|avatar, `size` (number, min hit 44), `background` (token string), `tooltip` default\|hover\|none, `disabled` |
| `Chip` | `label`, `selected`, `startIcon`, `role` button\|radio, `disabled` |
| `ChipGroup` | `options[{key,label,icon,testid}]`, `selected`, `onSelect`, `label`, `disabled` (single-select) |
| `SegmentedControl` | `segments[{key,label}]`, `selected`, `onSelect`, `disabled` |
| `Avatar` | `size` xs 24\|sm 32\|md 40\|lg 56\|xl 96 or a number; `ring`; `background`/`foreground` (token); source precedence `svg` > `uri` > `initials` > `icon` > person placeholder. Bots use `icon={BotIcon}` (`libs/game-session-client-ts/src/custom-game-side.tsx`). There is no `kind` (person/bot/guest/empty) prop |
| `Badge` | `label`, `intent` neutral\|brand\|success\|warning\|destructive\|info (default brand), `tone` subtle\|solid, `size` sm\|md, `dot`, `invisible` |
| `P` / `Text` | `variant` body\|bodyBold\|label\|caption\|footnote\|mono\|inherit, `role`, `testId`. `Text` is the inline form |
| `H1`–`H6` | `size` title 32\|heading 24\|subtitle 20\|navigationTitle 16\|label, `tone`, `align`, `lines`, `numeral` |
| `Stack*` / `Grid` / `Surface` | Layout props: gap/padding as `none xs sm md lg xl 2xl 3xl`, align, justify, grow, wrap, overflow. Paint (`Surface`): `tone` (background, surface, muted, elevated, overlay, tint-subtle, destructive, success, warning, info), `radius` (none, sm, control, card, sheet, full), `border` |
| `Card` | `children`, `as`, `id`, `tabIndex` (no variants) |
| Modal | `ModalRoot` (`visible`, `onRequestClose`, `label`, `stackId`) + `ModalContent` (`size` small 360\|medium 440\|large 720\|fullWidth, `maxHeight`, `padded`); `ConfirmationModal` |
| `MutationModal` | `visible`, `onClose`, `title`, `message`, `operation`, `submitLabel`, `cancelLabel`, `variant` default\|destructive, `successTitle`/`successBody`, `errorTitle`, `retryLabel`, phases idle→loading→success\|error |
| `EmptyState` / `LoadingState` | `variant` fill\|compact; `icon`, `title`, `body`, `action` / `caption`, `size` |
| `ErrorState` | `variant` fill\|compact\|band; `title`, `body`, `retry`, `secondary`, `details`, `copy` |
| `Notice` | `tone` neutral\|info\|success\|warning\|error, `icon`, `onDismiss` (dismissible) |
| `NumberStepper` | `label`, `value`, `onChange`, `min`, `max`, `step`, `disabled` |
| `MenuRow` | `title`, `caption`, `leading`, `value`, `valueLines`, `trailing`, `hideChevron`, `selected`, `current`, `onClick`/`href`/`submit`, `disabled` |
| `MenuSection` | `title`, `footer`, `role` menu\|group, `separator` |
| `ActionBar` | `items`, `textActions`, `endSlot`, `align` start\|end, `overflow` auto\|always\|never, `buttonSize`, `showInlineLabels`, `renderMenu` |
| `BottomActionBar` | `items`: `{type:'action', icon, label, selected}` \| `{type:'button', title, intent, variant, loading, flex}` |
| `ScreenBase` | `screenId`, `breadcrumbs`, `actions`, `content`, `scroll`, `largeTitle`, `leading`, `footer` |
| `Skeleton` | `width` (px or %), `height`, `shape` text\|rect\|circle |
| `game-*` | `GameScreen{screenId,title,subtitle}` / `GameLayout{aside}`; `GameSessionLayout{notices,setup,children,status,actions,aside}`; `GameBoardStage{top,bottom,children}`; `GamePlayerBar{name,avatar,tags,trailing,active,children}`; `GameStatus{title,detail,tone neutral\|active\|success\|warning,note,trailing,live}`; `GameStat{label,value,detail}`; `GameSection{title,description,footer}`; `GameSetupPanel{title,description,actions,details}`; `GameActionButton{title,operation,variant,disabled,successLabel}`; `GameChoiceGrid{label,choices,value,onChange}`; `GameDisclosure`; `GameClock{label,value,active,low}`; `GameCountdown`; `GameSearchState` |

### 2b. Brief components: what exists and under what name

| Brief | Exists as | Gap |
| --- | --- | --- |
| Text | `P`/`Text` + `H1`–`H6` | Role names differ: target display-xl/display/stat/title/body/body-strong/caption/label |
| Stack / Grid | `StackVertical`/`StackHorizontal`/`Stack`, `Grid`, `Layer` | — |
| Surface | `Surface` (tone/radius/border) | Tones need renaming to surface/raised/sunken |
| Divider | `Divider` (`orientation`) | — |
| Icon | `Icon` + `icons.ts` | Raw numeric sizes are common (§3) |
| Button primary/secondary/ghost/danger | `Button` intent×variant | No `secondary` intent; today it is neutral + outline or solid. Collapse to the brief's 4 |
| IconButton | `IconButton`, `BackIconButton`, `CloseIconButton` | — |
| Chip / ToggleGroup | `Chip`, `ChipGroup`, `SegmentedControl`, `RadioGroup`, `GameChoiceGrid` | Four overlapping single-select controls |
| Stepper | `NumberStepper` | — |
| Avatar person/bot/guest/empty seat | `Avatar` (placeholder, `icon`) | No `kind` prop; bot = `BotIcon`; empty seat = placeholder; guest not distinct |
| ListRow / List | `MenuRow`/`MenuSection`/`MenuList`, `List`/`ListItem`, `MainMenuItemRow`, `CatalogListRows` | Three list families |
| Badge / Tag (Host, LIVE) | `Badge` (`dot`) | LIVE is product code `Badge dot="online"` in `libs/spaces-client-ts/src/space-live-badge.tsx:25`; no `live` intent/token |
| Sheet | `WebBottomSheet`, `ResponsiveSurface` (sheet compact / modal wide) | — |
| Dialog | `ModalRoot`+`ModalContent`, `ConfirmationModal`, `MutationModal` | — |
| Toast | **banned** (README rule 11, `tests/no-toast.test.ts`); `DismissibleBanner` exists | Policy change needed |
| EmptyState / ErrorState | `EmptyState`, `ErrorState` (+`StateBlock`, `SuccessState`) | — |
| Skeleton | `Skeleton` (registered; used by profile/friends) | No board skeleton |
| NavBar / TopBar | `TopBar`, `TabBar`, `AppHeaderIsland`, `ScreenBase` header | — |
| Turn pill / watcher count / seat chip rail / standings / stat tiles | `GameStatus` (line, not pill); `SpectatorIndicator` (no count); `GameStat` | No rail, standings or rematch-readiness list (§5) |

---

## 3. Hard-coded values

Method: scan `*.css`, `*.ts` and `*.tsx` (tests excluded) for hex,
`rgb`/`hsl`/`oklch(` and `<n>px` literals outside comments. Each hit is
classed by line: font, radius, hairline (≤2px border/outline) or
space/size.

**`ui/` + `skin.css`: 34 of 475 files hit.** Totals: 29 color, 3 font,
7 radius, 51 hairline, 71 space/size.

| File | Hits | Notable |
| --- | --- | --- |
| `ui/social-provider-config.tsx` | color 23 | Google/Apple button colors `#FFFFFF`, `#747775`, `#131314` (:55–78); brand-mandated |
| `ui/hosts.css` | 20 (hairline 7, size 13) | `border: 1px solid var(--ui-color-border)` |
| `ui/game-ui.module.css` | 18 (hairline 7, size 11) | `max-width: 560px` (:20), `min-height: 76px` (:101), `min-height: 44px` (:57) |
| `ui/cell-grid-board.module.css` | 16 (font 1, size 10) | `font-size: 0.75rem` (:19), `clamp(0.75rem, 3.5vw, 1.25rem)` (:50), `border-width: 3px` (:72) |
| `ui/disc-drop-board.module.css` | 9 | `border-radius: 50%`, `outline: 3px` |
| `ui/card-table.module.css` | 8 | hairlines |
| `ui/brand-logos.tsx` | color 6 | SVG fills `#FFC107`, `#6366F1` (:19–47) |
| `ui/content-edge-padding.module.css` | 6 | `var(--ui-flush-*, 0px)` fallbacks |
| `ui/tile-board.module.css` | 6 | `clamp(0.75rem, 3.5vw, 1.5rem)` (:68); `2px dashed var(--color-success)` |
| `ui/theme.css` | 5 | breakpoints 640/768/1024/1280 (Tailwind requires literals) |
| `ui/trail-arena.module.css` | 3 | `font-size: 1.3px` (:102, SVG user units) |
| `ui/pagination-controls.tsx` | radius 2 | `'border-radius': '9999px'` (:52, :59) instead of `rounded-full` |
| `ui/text-input.tsx` | font 1 | `'line-height': '24px'` (:138) |
| `ui/spectator-indicator.tsx` | 1 | inline `height: '24px'`, `EyeIcon size={14}` (14 is not an icon token) |
| `ui/screen-measure.ts` | 2 | `menu: '480px'`, `prose: '640px'` (not tokens) |
| `ui-root-shared-ts/src/modal-size.ts:8` | — | `MODAL_WIDTH_PX` 360/440/720 (not tokens) |
| `ui/avatar.tsx:49` | — | `AVATAR_SIZES` 24/32/40/56/96 (not tokens) |

**Other drift in `ui/`:**

- *Numeric Tailwind spacing steps*: about 665 uses (`gap-1`, `px-2`, …)
  against 55 named-token utilities (`gap-ui-sm`). The steps are on the 4px
  grid but bypass `--ui-space-*`, so retuning the scale misses them. The
  biggest users are `button-parts.tsx`, `floating-menu-parts.tsx`,
  `error-state.tsx` and `top-bar.tsx`.
- *Numeric icon sizes* outside the 12/16/20/24/32/48 tokens: `size={18}`
  ×13 and `size={28}` ×8, among 18×`24`, 17×`20`, 16×`32` and others.
- *Inline styles*: `style=` appears 106 times in 58 files, and
  `cssPx`/`cssGap` 44 times.
- *Two variable prefixes*: `cell-grid-board.module.css` and
  `tile-board.module.css` read `var(--color-*)` (44 uses). The other 21 CSS
  files read `var(--ui-*)` (727 uses).

**Game client libs** (11 game `-client-ts` packages plus `game-session`,
`game-matchmaking`, `game-puzzle` and `game-menu` client): **0 hits.** The
composition lint holds. The hits are in sibling board packages:

| File | Hits |
| --- | --- |
| `pkgs/chess-board-root-shared-ts/src/board-theme.ts` | 35 colors: annotation glyphs `#3ad07a`, `#f06464`, … (:20–24) |
| `libs/chess-root-shared-ts/src/board-theme.ts:10-16` | `BOARD_THEME`: `#DEE3E6`, `#8CA2AD`, `#6F8794`, `rgba(29,155,240,.38/.50)` (fixed, scheme-independent by design) |
| `pkgs/chess-board-root-client-ts/src/chess-board/chess-board.module.css` | 9 (font 1, radius 2, size 6); `var(--chess-move-ms, 150ms)` |
| `libs/numberlink-shared-ts/src/numberlink-types.ts:4` | `PAIR_COLORS` names (red … purple), mapped to `pathRed…pathPurple` tokens |

### 3a. Tokens: current vs target

| Scale | Current (`design-tokens.json`) | Target |
| --- | --- | --- |
| Scheme | light + dark, default `system` | dark-first |
| Canvas | dark `background` #000000 / light #FFFFFF | `surface` #111113 |
| Paper | dark `surface` #121212, `surfaceElevated` #1A1A1A, `surfaceMuted`/`surfaceOverlay` #262626 | `surface-raised` #1c1c1f, `surface-sunken` #0b0b0c |
| Lines | `border` #333333 (dark), `outline` #737373 | `line`, `line-strong` |
| Ink | `text` #F5F5F5, `textSecondary` #A8A8A8, `icon` | `ink`, `ink-muted` |
| Primary | `tint` hsl(204 100% 62%) #3DB1FF dark / #006EB8 light; `tintActive` #0077C7 fill; `tintSubtle`; `onPrimary` | `primary` #2563eb, `primary-strong`, `primary-ink`, `primary-soft`, `on-primary-soft` |
| Status | `destructive`, `success`, `warning`, `info` (+`*Surface`, `on*`) | `success`, `danger`, `live` (new) |
| Focus / scrim | `focusRing`, `scrim` (dark α .72), `onTintScrim` | `focus`, `scrim` |
| Seat colors | none. Six `path*` colors (red, orange, yellow, green, blue, purple) for PathGridBoard only | `player-1..8` |
| Board | none (chess `BOARD_THEME` hard-coded) | `board-*` |
| Font | one system stack + mono | Unbounded (display/numbers) + Manrope (text) |
| Type sizes / leading | 12/16, 14/20, 16/24, 20/28, 24/32, 32/40; weights 400/600/700 | display-xl 40/44, display 26/30, stat 20/24, title 18/24, body 15/22, body-strong, caption 13/18, label 12/16 |
| Space | t-shirt `none xs sm md lg xl 2xl 3xl` = 0 4 8 12 16 24 32 48; scale also has 20, 40, 64 | 4, 8, 12, 16, 24, 32, 48 (matches minus 0/20/40/64) |
| Radius | `sm` 4, `control` 8, `card`/`sheet` 12, `full` | sm 6, md 12, lg 20, pill |
| Control height | 32 / 44 / 52 | — |
| Shadow / motion | `shadow-float`; 150/200/250ms | — |

Every palette pair is held to WCAG AA by `palette-contrast.test.ts`, and the
theme is held to the tokens by `theme-artifacts.test.ts`. Both must be
updated with the new palette.

---

## 4. Game chrome per game

Constructors: every game calls `defineGame` (shared) and `defineGameClient`
(client). None composes `GameStatus` or `GamePlayerBar`. None supplies
`choices` or `Frame`. Only chess supplies `screens` and `settings`. The
framework's own seats, status, setup and result chrome is in
`libs/game-session-client-ts` (§5).

| Game | Shared `defineGame` | Client `defineGameClient` | Seats (min–max), names, marks | Bots | Capabilities |
| --- | --- | --- | --- | --- | --- |
| battleship | `libs/battleship-shared-ts/src/battleship-game.ts:9` | `libs/battleship-client-ts/src/battleship-game-client.tsx:6` | 2: "Blue fleet" / "Red fleet" (`battleship-copy.tsx:35`); no colors | easy/med/hard | custom, matchmaking (clock), history; private `rules.setup` → `SetupBoard` |
| chess | `libs/chess-sub-shared-ts/src/chess-game.ts:18` | `libs/chess-root-client-ts/src/chess-game-client.tsx:34` | 2: White / Black; `canFlip` | 1 bot (`difficulties: []`) | custom, matchmaking (clock), history (PGN), **puzzles**, `own` room, `settings`, `screens` |
| chess-puzzle | part of chess: `chessPuzzles` `libs/chess-puzzle-shared-ts/src/chess-puzzles.ts:35`, `chessPuzzlesClient` `libs/chess-puzzle-client-ts/src/chess-puzzles-client.tsx:43` | — | inherits chess | — | puzzles: Board, coach, Companion, themes, notation, useFeedback |
| connect-four | `libs/connect-four-shared-ts/src/connect-four-game.ts:11` | `libs/connect-four-client-ts/src/connect-four-game-client.tsx:6` | 2: "Red circle" / "Yellow diamond" (`connect-four-presentation.tsx:21`); notices say "Red"/"Yellow" | easy/med/hard | custom, matchmaking (clock), history |
| hearts | `libs/hearts-shared-ts/src/hearts-game.ts:50` | `libs/hearts-client-ts/src/hearts-game-client.tsx:6` | exactly 4: South/West/North/East (`hearts-copy.tsx:9`) | easy/med | custom, history; `rules.hands` + commit; no matchmaking |
| light-cycles | `libs/light-cycles-shared-ts/src/light-cycles-game.ts:139`, ×3 modes at :167–169 | `light-cycles-game-client.tsx:42/51/60` | 2/3/4 per mode; Comet/Ember/Nova/Volt, letter marks C/E/N/V (`light-cycles-config.ts:110`) | easy/med/hard | simulation, custom (+`localPlayers`), matchmaking (no clock), history; `configuration` + `Configuration` |
| numberlink | `libs/numberlink-shared-ts/src/numberlink-game.ts:4` (puzzle only) | `libs/numberlink-client-ts/src/numberlink-game-client.tsx:9` | solo; pair colors `PAIR_COLORS` | — | `puzzleContent` (Player, Preview, Editor) |
| pong | `libs/pong-shared-ts/src/pong-game.ts:130` (+`defineSimulation` :62) | `libs/pong-client-ts/src/pong-game-client.tsx:8` | 2: Left / Right | easy/med/hard | simulation, custom (+`localPlayers`), matchmaking, history; `Configuration` |
| quoridor | `libs/quoridor-shared-ts/src/quoridor-game.ts:34`, ×2 at :62–63 | `libs/quoridor-client-ts/src/quoridor-game-client.tsx:55/74` | classic 2, hill 4; glyph marks ●◆▲■ (`quoridor-board-cells.tsx:16`); client and notice names differ | easy/med/hard | custom, matchmaking (clock), history |
| sokoban | `libs/sokoban-shared-ts/src/sokoban-game.ts:4` (puzzle only) | `libs/sokoban-client-ts/src/sokoban-game-client.tsx:9` | solo | — | `puzzleContent` + bundled pack |
| word-tiles | `libs/word-tiles-shared-ts/src/word-tiles-game.ts:45` (2-seat), `:19` ×2 at :60–61 (3/4) | `libs/word-tiles-client-ts/src/word-tiles-game-client.tsx:73/92/103` | 2/3/4 per mode; Amber/Teal/Violet/Coral (color names, no color passed) | easy/med/hard | custom, history (all); matchmaking + `puzzleContent` (2-seat only); `rules.hands` |

### 4a. Chrome a game renders itself (instead of the framework)

| Game | Where (file:line) | What | Built from |
| --- | --- | --- | --- |
| battleship | `battleship-board.tsx:169-176` | Status/turn line with last shot, whose turn, "You win" (`battleship-copy.tsx:49-86`) | `P role=status` |
| | `battleship-board.tsx:177-203`, `:71` | Fleet / Targeting panel switch, grid headers | `PairedPanels`, `H3` |
| | `battleship-board.tsx:46-60` | Sunk-ship tags | `Badge` |
| | `battleship-setup-board.tsx:47-147` | Setup UI: progress status, fleet-locked notice, ship picker, Rotate/Remove, refusal | `P`, `Notice`, `GameChoiceGrid`, `Button`, `CellGridBoard` |
| chess | `libs/chess-shared-client-ts/src/chess-settings-screen.tsx:28-37`, `chess-settings-developer-*.tsx` | Own settings and developer screens | `MainMenuScreen`, `ExplorerList`/`Detail` |
| | `pkgs/chess-board-root-client-ts/src/chess-board-live-region/index.tsx:16`, `chess-board-promotion.tsx:168` | In-board live region, promotion picker | own markup |
| chess-puzzle | `libs/chess-puzzle-client-ts/src/puzzle-management-screen.tsx:41-125`, `puzzle-source-controls.tsx:43-131`, `puzzle-import-status.tsx:22-90`, `puzzle-import-stop.tsx:32-45` | Puzzle import admin screen at `/more/puzzles` | `ContentScreen`, `MenuSection`/`MenuRow`, `Notice`, `ProgressBar`, `FilePicker`, `MutationModal` |
| connect-four | — | none (only `DiscDropBoard`) | — |
| hearts | `hearts-table-view.tsx:89-118` (`seatFacts` :69) | Player list around table: you, cards, Score, Taken, Passed/Choosing, active seat | `CardTable` seats |
| | `hearts-table-view.tsx:165-197` | Center status: pass progress, "X to play", trick taken, hearts broken, deal scores | text |
| | `hearts-table-view.tsx:142-152` | **Final standings** sentence `finalResult` | text |
| | `hearts-board.tsx:64-86` | Hand panel and "Pass N of 3 cards" action | `CardTable action` |
| light-cycles | `light-cycles-options.tsx:19-52` | Setup option: target score | `TextInput`, `GameActionButton` |
| | `light-cycles-board.tsx:49-77` | Scoreboard: per-rider score, "Round N · first to T" | `Text` |
| | `light-cycles-board.tsx:127-133`, `:152-158`, `:165-181`, `:79-108` | Status line, key legend, "Ride from this device", per-seat direction pads | `P`, `Button`, `DirectionPad` |
| | `light-cycles-view.tsx:68-94` | In-arena overlay: countdown, round winner, "X wins the game" | `TrailArena` overlay |
| numberlink | `numberlink-player.tsx:45-79` | Help caption, drawing error | `P`, `Notice` |
| | `numberlink-editor.tsx:19-222` | Editor: cols/rows steppers, coverage, pair picker, label/color, Add/Remove/Clear with own confirm | `NumberStepper`, `Select`, `TextInput`, `Button`, `MutationModal` |
| pong | `pong-options.tsx:9-40` | Setup option: points to win | `TextInput`, `GameActionButton` |
| | `pong-board.tsx:96-115`, `:174-186` | Scoreboard "Left N / First to N / Right N", winner/paused/serve status | `H3`, `Text`, `P role=status` |
| | `pong-board.tsx:41-78`, `:153-160` | Paddle sliders, controls help | `RangeControl`, `P` |
| quoridor | `quoridor-board.tsx:93-109` | Player list: name, walls left, "— to move" | `StackHorizontal`, `P` |
| | `quoridor-board.tsx:19-47`, `:110-126` | Tool bar (Move / H wall / V wall) and pass-turn action | `Button` (aria-pressed) |
| | `quoridor-board.tsx:88-92`, `:144-147` | Goal caption, status/refusal line | `P` |
| sokoban | `sokoban-player.tsx:53-62` | "Moves · Pushes" counter | `P role=status` |
| | `sokoban-player.tsx:74-101` | D-pad, help, refusal notice | `Button`, `P`, `Notice` |
| | `sokoban-editor.tsx:44-194`, `sokoban-size-controls.tsx:24-51` | Editor tool palette, size inputs, corrections list | `Button`, `TextInput`, `Notice` |
| word-tiles | `word-tiles-panels.tsx:22-60` (used `word-tiles-board.tsx:216`) | Scoreboard: per-seat score, rack count, "— to play", bag, scoreless turns | `P` |
| | `word-tiles-board.tsx:98-154`, `:59-96` | **Action bar**: Play word, Recall, Undo, Redo, Shuffle, Pass, Exchange | `Button` |
| | `word-tiles-panels.tsx:63-117`, `word-tiles-board.tsx:232-258` | Score preview, status, blank chooser, spectator note, retry | `P`, `Button` |
| | `word-tiles-puzzle-player.tsx:108-161`, `word-tiles-puzzle-editor.tsx:71-175` | Puzzle header/score, puzzle action bar, editor fields | `P`, `Button`, `TextInput`, `Select` |

Six games draw their own player list or scoreboard: hearts, light-cycles,
pong, quoridor, word-tiles and battleship (sunk tags). Seven draw their own
status line: battleship, hearts, light-cycles, pong, quoridor, sokoban and
word-tiles. Three put an action bar inside the board: word-tiles, quoridor
and hearts. Hearts and light-cycles render the final result in the board.
Pong and light-cycles render their setup options through
`presentation.Configuration`, which the framework mounts in "Game options"
(`custom-game-configuration.tsx:79`).

---

## 5. The current game framework contract

### 5a. What a game implements

**Shared: `defineGame(game)`** (`libs/game-session-shared-ts/src/game-definition.ts:210-245`)

| Field | Type / source | Notes |
| --- | --- | --- |
| `rules` | `GameRules` / `GamePositionRules` (`pkgs/turn-game-shared-ts/src/game-rules.ts:208-276`) | `id`, `family?`, `sides?` (2–4 of white/black/red/blue), `recognizes`, `initial`, `play`, `replay`, `legal`, `canWin`, `moves`, `setup?` (private setups), `hands?` (+`commit?`), `turnOrder?`, `prepare?`, `configuration?{apply(position, choice: string), restart}` |
| `capabilities` | `TurnGameCapabilities` (:373) | `'custom-games'?{bots:{difficulties, choose?}, localPlayers?}`, `matchmaking?{namespace, notice, clockChoices?}` (requires `history`), `history?{record}`, `puzzles?` |
| `turnAutomation` / `continuousAutomation` | `game-automation.ts` | Bot or synthetic gesture on the board |
| `simulation?` | `RegisteredSimulation` (`game-simulation.ts`) | Realtime games (pong, light-cycles) |
| `puzzleContent?` | `PuzzleContent` (`puzzle-content.ts:120`) | `rules`, `rulesVersion`, `solver?`, `validatePublication?`, `statistics?(def,state) → Record`, `bundledPacks?`, `starter?` |
| `own?`, `unprefixedNamespace?` | `GameOwnRoom` | Chess only |
| Puzzle-only form | `{ id, puzzleContent, own? }` (`puzzle-game-definition.ts:6`) | numberlink, sokoban |

**Client: `defineGameClient(game)`** (`libs/game-menu-client-ts/src/game-client.tsx:57-201`)

| Field | Notes |
| --- | --- |
| `shared` | The `defineGame` value; its id |
| `title`, `caption`, `subtitle()`, `instructions?()` | Menu copy (the manifest name) |
| `presentation` (`GamePresentation`, `pkgs/turn-game-shared-ts/src/game-presentation.ts:52`) | `name()`, `canFlip`, `Board(GameBoardProps)`, `SetupBoard?`, `Configuration?({position, onChoice})`, `sideLabel(side)`, `endingDescription(reason)`, `endingLabel(reason)`, `timeoutDrawDescription?` (required with clock choices), `refusalDescription?` |
| `puzzles?` | `GamePuzzlesClient` (required exactly when `capabilities.puzzles`) |
| `puzzleContent?` | `{ Player, Preview?, authoring?{Editor, initialDefinition} }` (`libs/game-puzzle-client-ts/src/puzzle-content-client.ts:21`) |
| `choices?`, `screens?`, `settings?`, `Frame?`, `SessionEffects?` | The game's own screens (escape hatch for own chrome) |

`GameBoardProps` passes the board `position`, `orientation`, `interactive`,
`sound`, `onAction`, `setup`, `hand`, `committed`, `commitment` and
`simulation`. It passes **no** seats, people, scores or turn info beyond the
opaque position, so a board that wants a scoreboard must decode its own
position and draw one.

### 5b. Framework-owned chrome today

| Brief area | Today (file) | Gap vs brief |
| --- | --- | --- |
| Seat list | `CustomGameSeat` → `GamePlayerBar` (`libs/game-session-client-ts/src/custom-game-side.tsx:150`). Seat kinds `person\|bot\|local\|invitation\|open\|closed` (`libs/game-session-shared-ts/src/custom-game-state.ts:18`). Badges: Ready, Getting ready, Stand-in bot | Max 4 seats; no player-count stepper (count = mode) |
| Generic options | Clock: `TextInput` ×2 + buttons (`custom-game-configuration.tsx:27-60`). Game options: `GameDisclosure` mounting the game's `Configuration` (:79, :154) | No options schema; options are an opaque string plus a game-drawn form |
| Start, disabled with reason | `CustomGameConfiguration` (`custom-game-configuration.tsx:93-163`): "Every place must be filled and every person ready." / Start game | One fixed reason string |
| Roles | Space role `'host'\|'guest'` (`libs/spaces-client-ts/src/use-member-role.ts:8`); seated or watcher through `mySide()`; `SpectatorIndicator` | No member/seated-guest/spectator split in chrome; no watcher count |
| Play: opponents | `GameBoardStage top` = `FarSeats`: every other seat stacked vertically (`custom-game-board.tsx:236-251`, `:280-299`) | No compact rail of chips for 3+ seats |
| Play: board / own strip | `GameBoardStage` children (game `Board` via `Dynamic`, :302) and `bottom` (own seat) | — |
| Turn pill | `CustomGameStatus` → `GameStatus` line + Unrated/clock badges (`custom-game-status.tsx:239-262`); text from `gameStateDescription` using `sideLabel` and `endingDescription` | Not a pill; games duplicate it in-board |
| Action bar | `CustomGameDrawActions`/`NextActions`/`ExitActions` (`custom-game-actions.tsx`, `custom-game-screen.tsx:81-86`): resign, draw, rematch, leave | Game moves/actions have no slot |
| Game over | `GameStatus` ending text + Rematch button (`custom-game-actions.tsx:70`); history `GameStat` tiles (`game-history.tsx:190-200`); matched ratings `GameStat` (`multiplayer-ratings.tsx:39`) | No headline, no 1st–8th standings, no rematch-readiness list, no solo stat tiles (`PuzzleContent.statistics` is stored by `libs/game-puzzle-shared-ts/src/attempt-completion.ts:22`, never shown) |
| Matched games | `libs/game-matchmaking-client-ts/src/multiplayer-{screen,board,seat,status}.tsx`: the same primitives | Parallel implementation of seats and status |

### 5c. Brief `GameDefinition` piece → current

| Brief piece | Current | Status |
| --- | --- | --- |
| Manifest: name | `defineGameClient.title`, `presentation.name()`, `rules.id`, `family` | Exists (split) |
| Manifest: min/max players 1–8 | `rules.sides` (2–4); modes per count; puzzle content = solo | **Missing** (cap 4; no min/max/range) |
| Manifest: default count | — (each mode fixed) | **Missing** |
| Manifest: bot support | `capabilities['custom-games'].bots` (`difficulties`, `choose`) | Exists implicitly (presence = support) |
| Options schema | `rules.configuration.apply(position, choice: string)` + `presentation.Configuration` component; clock choice framework-owned | **Missing** as a declarative schema |
| Per-seat info: side label | `presentation.sideLabel(side)`, server copy `matchmaking.notice.side` (duplicated) | Exists |
| Per-seat info: color/mark | none; marks are inside boards (quoridor glyphs, light-cycles letters, connect-four names); tokens only `path*` ×6 | **Missing** |
| Board component | `presentation.Board`, `SetupBoard`, `puzzles.Board`, `puzzleContent.Player/Editor/Preview` | Exists |
| Action list | none; `rules.legal`/`moves` are moves, not commands; games render buttons in-board | **Missing** |
| Turn-status string | framework derives it (`custom-game-status.tsx`); games also draw their own | **Missing** as a game-supplied string |
| Result summary | `PlayedPosition.winner` (`GameWinner` = side \| 'draw' \| side[]), `reason`, `endingDescription`/`endingLabel`/`timeoutDrawDescription`; `history.record` (file text); `PuzzleContent.statistics` | Partial: no scores/standings type; scores only in board text and records |

---

## 6. Old → new map

| Current | Target design-system component |
| --- | --- |
| `P`/`Text` (`body`, `bodyBold`, `label`, `caption`, `footnote`, `mono`), `H1`–`H6` (`title`, `heading`, `subtitle`, `navigationTitle`, `label`), `numeral` | `Text` with display-xl / display / stat / title / body / body-strong / caption / label |
| `StackVertical`/`StackHorizontal`/`Stack`, `Grid`, `Layer` | `Stack` / `Grid` |
| `Surface` tone background/surface/muted/elevated/overlay, `Card` | `Surface` surface / raised / sunken |
| `Divider` | `Divider` |
| `Icon` + `icons.ts` (numeric sizes) | `Icon` (token sizes only) |
| `Button` primary/solid, neutral/outline, ghost, danger; `GameActionButton` | `Button` primary / secondary / ghost / danger |
| `IconButton`, `BackIconButton`, `CloseIconButton`, `ActionBarIconButton` | `IconButton` |
| `Chip`, `ChipGroup`, `SegmentedControl`, `GameChoiceGrid`, `RadioGroup` | `Chip` / `ToggleGroup` |
| `NumberStepper`; numeric `TextInput` in `pong-options.tsx`, `light-cycles-options.tsx`, clock inputs | `Stepper` |
| `Avatar` (+placeholder, `icon={BotIcon}`), `AvatarGroup`, `SpeakingAvatar` | `Avatar` person / bot / guest / empty seat |
| `MenuRow`/`MenuSection`/`MenuList`, `List`/`ListItem`, `MainMenuItemRow`, `CatalogListRows` | `ListRow` / `List` |
| `Badge` (+`dot`), `SpaceLiveBadge` (product) | `Badge` / `Tag` (Host, LIVE) |
| `WebBottomSheet`, `ResponsiveSurface` | `Sheet` |
| `ModalRoot`+`ModalContent`, `ConfirmationModal`, `MutationModal` | `Dialog` (MutationModal stays as its mutation wrapper) |
| `Notice` (inline), `DismissibleBanner` | `Toast` (blocked by rule 11) / inline notice |
| `EmptyState`, `ErrorState`, `LoadingState`, `StateBlock`, `SuccessState` | `EmptyState`, `ErrorState` |
| `Skeleton` | `Skeleton` |
| `TopBar`, `AppHeaderIsland`, `ScreenBase` header, `TabBar` | `NavBar` / `TopBar` |
| `GameScreen` + `GameSessionLayout` | Game frame shell (Setup / Play / Game over) |
| `GamePlayerBar` + `custom-game-side.tsx` / `multiplayer-seat.tsx` | Seat row (Setup), own strip, opponent strip (Play) |
| `FarSeats` stack (`custom-game-board.tsx:236`) | Opponent strip (2 seats), rail of chips (3–8), nothing (solo) |
| `GameBoardStage` | Board slot |
| `GameStatus` | Turn pill |
| `GameClock`, `GameCountdown` | Seat clock in strip / turn pill |
| `GameSection`/`GameActions`, `custom-game-actions.tsx` | Action bar |
| `GameSetupPanel`, `custom-game-configuration.tsx`, `GameDisclosure` | Setup: generic options, Start game with reason |
| `GameStat` (history, ratings) | Solo stat tiles / standings |
| `SpectatorIndicator` | Watching footer + header watcher count |
| Game in-board scoreboards, status lines and action bars (§4a) | Removed; supplied as data (per-seat info, turn-status string, action list, result summary) to the frame |

### Which screens use the shared game frame

| Screen | Uses frame today | Frame pieces bypassed |
| --- | --- | --- |
| Custom game (`custom-game-screen.tsx`), all turn and realtime games | Yes: GameScreen, GameSessionLayout, GameBoardStage, GamePlayerBar, GameStatus | Game-drawn status, scores, actions in `Board` (§4a); game `Configuration` form |
| Matched game (`multiplayer-screen.tsx`) | Yes: same primitives, separate implementation | Same as above |
| Puzzle play (`puzzle-play-layout.tsx`, chess) | `PuzzleScreen` (own family) | — |
| Puzzle content attempt / author / edition (`content-*-screen.tsx`; numberlink, sokoban, word-tiles) | `GameScreen` + `GameSessionLayout`, with no seats or status | Game Player draws counters, d-pads and action bars; editors draw toolbars |
| History / review (`game-history.tsx`, `puzzle-review-screen.tsx`) | `GameHistoryScreen` / `GameReviewScreen` | — |
| Chess settings / developer, `/more/puzzles` | No (game-owned screens) | Entire screen |
