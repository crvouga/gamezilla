<!-- overhaul-loop:media-round-5-part-1 -->
## Board round 5 — screenshots and videos, part 1
Candidate `d2ee6467e23b84ffd7b5128fb993a614df68a7d2` · evidence `1459fd0b37554c88` · immutable media `b69dc3f7f93ddd7467c2057b56a974e60178b410`.
[Manifest](https://github.com/crvouga/gamezilla/blob/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/manifest.json) · [All screenshots](https://github.com/crvouga/gamezilla/blob/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/GALLERY.md) · [Before/after pairs](https://github.com/crvouga/gamezilla/blob/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/pairs) · [Exact outcomes and remaining gates](https://github.com/crvouga/gamezilla/blob/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/HANDOFF.md)
All 752 visual cases passed native readiness/play, browser-error and serious/critical axe stages. Eight font checks and the instrumented chess regression passed. Pixel comparisons, full bun verify, hosted safety and Ubuntu reference decisions are reported separately; no macOS references were accepted.
Round-four images are the before state. Runtime/play/axe, pixel comparisons, full local verification, hosted safety and canonical Ubuntu reference acceptance have separate verdicts in the manifest. No ratings, manual QA, merge or PR watch.
Recordings are automated assertion replays with recorder-only pacing, not natural user timing. The visible animated previews are sampled from the pinned WebM videos at 2 fps; click a preview for its complete recording. These are not GitHub inline video players. Phone 390×844 and desktop 1440×900 captures, both screenshot themes; native checks use desktop 1440×844.

### J1: ChessGameBoard
Chess: select piece, legal destination, observe move; promotion and orientation

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-chess-board--promotion-choice--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-chess-board--promotion-choice--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-chess-board--promotion-choice--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-chess-board--promotion-choice--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-chess-board--promotion-choice--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-chess-board--promotion-choice--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-chess-board--promotion-choice--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-chess-board--promotion-choice--desktop--dark.png) |

**Checks:** 40 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 40 failed; no macOS acceptance.
**Limits:** Promotion choice and board guidance are exercised; ordinary full-match and network turn progression are not established.

**Video — `screens-games-chess-board--promotion-choice`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-chess-board--promotion-choice--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-chess-board--promotion-choice--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-chess-board--promotion-choice--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-chess-board--promotion-choice--desktop--light.webm)

### J2: ChessPuzzleBoard
Chess puzzle: make solution moves; recover wrong move; hint

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-puzzles-chess-play--solve-journey--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-puzzles-chess-play--solve-journey--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-puzzles-chess-play--solve-journey--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-puzzles-chess-play--solve-journey--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-puzzles-chess-play--solve-journey--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-puzzles-chess-play--solve-journey--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-puzzles-chess-play--solve-journey--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-puzzles-chess-play--solve-journey--desktop--dark.png) |

**Checks:** 29 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 29 failed; no macOS acceptance.
**Limits:** Puzzle fixture completion and wrong-move recovery; persisted attempt history and overview navigation remain outside this Storybook evidence.

**Video — `screens-puzzles-chess-play--solve-journey`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-puzzles-chess-play--solve-journey--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-puzzles-chess-play--solve-journey--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-puzzles-chess-play--solve-journey--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-puzzles-chess-play--solve-journey--desktop--light.webm)

**Video — `screens-puzzles-chess-play--wrong-move-recovery`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-puzzles-chess-play--wrong-move-recovery--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-puzzles-chess-play--wrong-move-recovery--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-puzzles-chess-play--wrong-move-recovery--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-puzzles-chess-play--wrong-move-recovery--desktop--light.webm)

**Video — `screens-puzzles-chess-play--keyboard-help`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-puzzles-chess-play--keyboard-help--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-puzzles-chess-play--keyboard-help--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-puzzles-chess-play--keyboard-help--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-puzzles-chess-play--keyboard-help--desktop--light.webm)

### J3: ConnectFourGameBoard
Drop a disc into a non-full column and observe turn/result

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-connect-four-board--connect-four-to-win--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-connect-four-board--connect-four-to-win--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-connect-four-board--connect-four-to-win--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-connect-four-board--connect-four-to-win--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-connect-four-board--connect-four-to-win--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-connect-four-board--connect-four-to-win--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-connect-four-board--connect-four-to-win--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-connect-four-board--connect-four-to-win--desktop--dark.png) |

**Checks:** 40 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 40 failed; no macOS acceptance.
**Limits:** Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification.

**Video — `screens-games-connect-four-board--connect-four-to-win`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-connect-four-board--connect-four-to-win--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-connect-four-board--connect-four-to-win--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-connect-four-board--connect-four-to-win--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-connect-four-board--connect-four-to-win--desktop--light.webm)

### J4: BattleshipSetupBoard
Place and rotate full fleet; recover invalid placement; ready

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-battleship-setup--arrange-full-fleet--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-battleship-setup--arrange-full-fleet--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-battleship-setup--arrange-full-fleet--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-battleship-setup--arrange-full-fleet--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-battleship-setup--arrange-full-fleet--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-battleship-setup--arrange-full-fleet--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-battleship-setup--arrange-full-fleet--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-battleship-setup--arrange-full-fleet--desktop--dark.png) |

**Checks:** 35 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 35 failed; no macOS acceptance.
**Limits:** Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification.

**Video — `screens-games-battleship-setup--arrange-full-fleet`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-battleship-setup--arrange-full-fleet--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-battleship-setup--arrange-full-fleet--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-battleship-setup--arrange-full-fleet--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-battleship-setup--arrange-full-fleet--desktop--light.webm)

**Video — `screens-games-battleship-setup--enlarged-placement`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-battleship-setup--enlarged-placement--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-battleship-setup--enlarged-placement--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-battleship-setup--enlarged-placement--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-battleship-setup--enlarged-placement--desktop--light.webm)

### J5: BattleshipBoard
Target untried square; observe hit/miss/sunk and turn

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-battleship-board--sink-the-fleet--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-battleship-board--sink-the-fleet--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-battleship-board--sink-the-fleet--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-battleship-board--sink-the-fleet--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-battleship-board--sink-the-fleet--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-battleship-board--sink-the-fleet--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-battleship-board--sink-the-fleet--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-battleship-board--sink-the-fleet--desktop--dark.png) |

**Checks:** 47 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 47 failed; no macOS acceptance.
**Limits:** Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification.

**Video — `screens-games-battleship-board--sink-the-fleet`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-battleship-board--sink-the-fleet--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-battleship-board--sink-the-fleet--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-battleship-board--sink-the-fleet--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-battleship-board--sink-the-fleet--desktop--light.webm)

**Video — `screens-games-battleship-board--correct-target-before-firing`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-battleship-board--correct-target-before-firing--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-battleship-board--correct-target-before-firing--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-battleship-board--correct-target-before-firing--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-battleship-board--correct-target-before-firing--desktop--light.webm)

### J6: NumberlinkPlayer
Draw all matching paths covering board; cancel/remove and recover

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-numberlink-puzzle--recover-with-pointer--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-numberlink-puzzle--recover-with-pointer--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-numberlink-puzzle--recover-with-pointer--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-numberlink-puzzle--recover-with-pointer--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-numberlink-puzzle--recover-with-pointer--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-numberlink-puzzle--recover-with-pointer--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-numberlink-puzzle--recover-with-pointer--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-numberlink-puzzle--recover-with-pointer--desktop--dark.png) |

**Checks:** 38 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 38 failed; no macOS acceptance.
**Limits:** Pointer fixture recovery uses synthetic touch events with native pointer capture stubbed; trusted touch capture and shared undo/redo are not established here. Separate production cross-device and offline flows passed, but the republication-title scenario failed; see release verdict.

**Video — `screens-games-numberlink-puzzle--recover-with-pointer`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-numberlink-puzzle--recover-with-pointer--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-numberlink-puzzle--recover-with-pointer--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-numberlink-puzzle--recover-with-pointer--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-numberlink-puzzle--recover-with-pointer--desktop--light.webm)

**Video — `screens-games-numberlink-puzzle--drawing-help`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-numberlink-puzzle--drawing-help--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-numberlink-puzzle--drawing-help--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-numberlink-puzzle--drawing-help--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-numberlink-puzzle--drawing-help--desktop--light.webm)

**Video — `screens-games-numberlink-puzzle--choose-path-to-remove`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-numberlink-puzzle--choose-path-to-remove--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-numberlink-puzzle--choose-path-to-remove--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-numberlink-puzzle--choose-path-to-remove--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-numberlink-puzzle--choose-path-to-remove--desktop--light.webm)

### J7: SokobanPlayer
Move and push every crate onto goals; recover blocked move; undo/redo

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-sokoban-puzzle--corner-recovery--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-sokoban-puzzle--corner-recovery--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-sokoban-puzzle--corner-recovery--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-sokoban-puzzle--corner-recovery--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-sokoban-puzzle--corner-recovery--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-sokoban-puzzle--corner-recovery--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-sokoban-puzzle--corner-recovery--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-sokoban-puzzle--corner-recovery--desktop--dark.png) |

**Checks:** 37 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 37 failed; no macOS acceptance.
**Limits:** Local production-rule history covers corner recovery, undo/redo, solving, restart and library callbacks. Separate production cross-device/offline flows passed; touch/swipe completion and every persisted history branch are not established.

**Video — `screens-games-sokoban-puzzle--corner-recovery`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-sokoban-puzzle--corner-recovery--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-sokoban-puzzle--corner-recovery--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-sokoban-puzzle--corner-recovery--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-sokoban-puzzle--corner-recovery--desktop--light.webm)

**Video — `screens-games-sokoban-puzzle--solved`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-sokoban-puzzle--solved--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-sokoban-puzzle--solved--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-sokoban-puzzle--solved--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-sokoban-puzzle--solved--desktop--light.webm)

**Video — `screens-games-sokoban-puzzle--unreadable`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-sokoban-puzzle--unreadable--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-sokoban-puzzle--unreadable--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-sokoban-puzzle--unreadable--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-sokoban-puzzle--unreadable--desktop--light.webm)

