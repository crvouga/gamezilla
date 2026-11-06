<!-- overhaul-loop:media-round-3-part-1 -->
## Board round 3 — screenshots and videos, part 1
Candidate `897a7562d2fee9d4cec187281ac84119de322c05` · evidence `71631a78b947264a`.
[Manifest](https://github.com/crvouga/gamezilla/blob/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/manifest.json) · [Screenshot gallery](https://github.com/crvouga/gamezilla/blob/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/GALLERY.md) · [Before/after pairs](https://github.com/crvouga/gamezilla/blob/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/pairs) · [Exhaustive story inventory](https://github.com/crvouga/gamezilla/blob/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/story-inventory.json) · [Journey limits](https://github.com/crvouga/gamezilla/blob/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/mapping.json)
All 620 visual cases passed native readiness/play, browser-error and serious/critical axe stages; all 8 controlled font checks passed. Local pixel comparisons remain separate and no macOS references were accepted. Full bun verify failed the pre-existing /more/troubleshooting statechart-owner rule. Hosted verify:end also failed the Numberlink library-navigation journey before board interaction. Two new independent reviews remain pending. Final-head Ubuntu reference authoring succeeded; comparison is still running in run 42255354537. No references are accepted, and pixel approval remains pending. The historical Ubuntu phone drift is not retroactively explained by current controlled-pair stability.
Automated Storybook only. No manual QA, ratings or merge. Videos use native Storybook assertion checkpoints with recorder-only pacing. These are pinned WebM links, not embedded video players. Before images are immutable round-2 captures; absent-before states are explicit. Test viewports: 390×844 and 1440×844; gallery viewports: 390×844 and 1440×900.

<details><summary>J1: ChessGameBoard — Chess: select piece, legal destination, observe move; promotion and orientation</summary>

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-chess-board--promotion-choice--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-chess-board--promotion-choice--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-chess-board--promotion-choice--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-chess-board--promotion-choice--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-chess-board--promotion-choice--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-chess-board--promotion-choice--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-chess-board--promotion-choice--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-chess-board--promotion-choice--desktop--dark.png) |

**Checks:** 40 canonical cases passed readiness/play, browser-error and serious/critical axe stages. Pixels: 0 passed, 40 failed; no macOS acceptance.
**Limits:** Promotion choice and board guidance are exercised; ordinary full-match and network turn progression are not established.

**Automated journey:** `screens-games-chess-board--promotion-choice`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-chess-board--promotion-choice--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-chess-board--promotion-choice--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-chess-board--promotion-choice--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-chess-board--promotion-choice--phone--light.webm)

</details>

<details><summary>J2: ChessPuzzleBoard — Chess puzzle: make solution moves; recover wrong move; hint</summary>

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-puzzles-chess-play--solve-journey--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-puzzles-chess-play--solve-journey--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-puzzles-chess-play--solve-journey--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-puzzles-chess-play--solve-journey--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-puzzles-chess-play--solve-journey--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-puzzles-chess-play--solve-journey--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-puzzles-chess-play--solve-journey--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-puzzles-chess-play--solve-journey--desktop--dark.png) |

**Checks:** 23 canonical cases passed readiness/play, browser-error and serious/critical axe stages. Pixels: 0 passed, 23 failed; no macOS acceptance.
**Limits:** Puzzle fixture completion and wrong-move recovery; persisted attempt history and overview navigation remain outside this Storybook evidence.

**Automated journey:** `screens-puzzles-chess-play--solve-journey`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-puzzles-chess-play--solve-journey--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-puzzles-chess-play--solve-journey--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-puzzles-chess-play--solve-journey--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-puzzles-chess-play--solve-journey--phone--light.webm)

**Automated journey:** `screens-puzzles-chess-play--wrong-move-recovery`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-puzzles-chess-play--wrong-move-recovery--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-puzzles-chess-play--wrong-move-recovery--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-puzzles-chess-play--wrong-move-recovery--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-puzzles-chess-play--wrong-move-recovery--phone--light.webm)

</details>

<details><summary>J3: ConnectFourGameBoard — Drop a disc into a non-full column and observe turn/result</summary>

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-connect-four-board--connect-four-to-win--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-connect-four-board--connect-four-to-win--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-connect-four-board--connect-four-to-win--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-connect-four-board--connect-four-to-win--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-connect-four-board--connect-four-to-win--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-connect-four-board--connect-four-to-win--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-connect-four-board--connect-four-to-win--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-connect-four-board--connect-four-to-win--desktop--dark.png) |

**Checks:** 40 canonical cases passed readiness/play, browser-error and serious/critical axe stages. Pixels: 0 passed, 40 failed; no macOS acceptance.
**Limits:** Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification.

**Automated journey:** `screens-games-connect-four-board--connect-four-to-win`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-connect-four-board--connect-four-to-win--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-connect-four-board--connect-four-to-win--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-connect-four-board--connect-four-to-win--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-connect-four-board--connect-four-to-win--phone--light.webm)

</details>

<details><summary>J4: BattleshipSetupBoard — Place and rotate full fleet; recover invalid placement; ready</summary>

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-battleship-setup--arrange-full-fleet--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-battleship-setup--arrange-full-fleet--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-battleship-setup--arrange-full-fleet--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-battleship-setup--arrange-full-fleet--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-battleship-setup--arrange-full-fleet--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-battleship-setup--arrange-full-fleet--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-battleship-setup--arrange-full-fleet--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-battleship-setup--arrange-full-fleet--desktop--dark.png) |

**Checks:** 34 canonical cases passed readiness/play, browser-error and serious/critical axe stages. Pixels: 0 passed, 34 failed; no macOS acceptance.
**Limits:** Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification.

**Automated journey:** `screens-games-battleship-setup--arrange-full-fleet`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-battleship-setup--arrange-full-fleet--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-battleship-setup--arrange-full-fleet--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-battleship-setup--arrange-full-fleet--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-battleship-setup--arrange-full-fleet--phone--light.webm)

**Automated journey:** `screens-games-battleship-setup--enlarged-placement`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-battleship-setup--enlarged-placement--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-battleship-setup--enlarged-placement--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-battleship-setup--enlarged-placement--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-battleship-setup--enlarged-placement--phone--light.webm)

</details>

<details><summary>J5: BattleshipBoard — Target untried square; observe hit/miss/sunk and turn</summary>

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-battleship-board--sink-the-fleet--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-battleship-board--sink-the-fleet--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-battleship-board--sink-the-fleet--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-battleship-board--sink-the-fleet--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-battleship-board--sink-the-fleet--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-battleship-board--sink-the-fleet--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-battleship-board--sink-the-fleet--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-battleship-board--sink-the-fleet--desktop--dark.png) |

**Checks:** 46 canonical cases passed readiness/play, browser-error and serious/critical axe stages. Pixels: 0 passed, 46 failed; no macOS acceptance.
**Limits:** Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification.

**Automated journey:** `screens-games-battleship-board--sink-the-fleet`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-battleship-board--sink-the-fleet--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-battleship-board--sink-the-fleet--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-battleship-board--sink-the-fleet--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-battleship-board--sink-the-fleet--phone--light.webm)

**Automated journey:** `screens-games-battleship-board--correct-target-before-firing`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-battleship-board--correct-target-before-firing--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-battleship-board--correct-target-before-firing--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-battleship-board--correct-target-before-firing--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-battleship-board--correct-target-before-firing--phone--light.webm)

</details>

<details><summary>J6: NumberlinkPlayer — Draw all matching paths covering board; cancel/remove and recover</summary>

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-numberlink-puzzle--recover-with-pointer--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-numberlink-puzzle--recover-with-pointer--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-numberlink-puzzle--recover-with-pointer--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-numberlink-puzzle--recover-with-pointer--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-numberlink-puzzle--recover-with-pointer--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-numberlink-puzzle--recover-with-pointer--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-numberlink-puzzle--recover-with-pointer--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-numberlink-puzzle--recover-with-pointer--desktop--dark.png) |

**Checks:** 30 canonical cases passed readiness/play, browser-error and serious/critical axe stages. Pixels: 0 passed, 30 failed; no macOS acceptance.
**Limits:** Pointer recovery uses synthetic touch events with native pointer capture stubbed; trusted touch capture, cross-session persistence and shared undo/redo remain unproven. Keyboard completion has a separate matrix story.

**Automated journey:** `screens-games-numberlink-puzzle--recover-with-pointer`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-numberlink-puzzle--recover-with-pointer--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-numberlink-puzzle--recover-with-pointer--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-numberlink-puzzle--recover-with-pointer--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-numberlink-puzzle--recover-with-pointer--phone--light.webm)

</details>

<details><summary>J7: SokobanPlayer — Move and push every crate onto goals; recover blocked move; undo/redo</summary>

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-sokoban-puzzle--corner-recovery--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-sokoban-puzzle--corner-recovery--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-sokoban-puzzle--corner-recovery--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-sokoban-puzzle--corner-recovery--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-sokoban-puzzle--corner-recovery--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-sokoban-puzzle--corner-recovery--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-sokoban-puzzle--corner-recovery--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-sokoban-puzzle--corner-recovery--desktop--dark.png) |

**Checks:** 35 canonical cases passed readiness/play, browser-error and serious/critical axe stages. Pixels: 0 passed, 35 failed; no macOS acceptance.
**Limits:** Local production-rule history fixture exercises corner recovery, undo, redo, solving and restart; shared persisted mutation history and touch/swipe completion remain unproven.

**Automated journey:** `screens-games-sokoban-puzzle--corner-recovery`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-sokoban-puzzle--corner-recovery--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-sokoban-puzzle--corner-recovery--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-sokoban-puzzle--corner-recovery--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-sokoban-puzzle--corner-recovery--phone--light.webm)

</details>

