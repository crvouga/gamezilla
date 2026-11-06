<!-- overhaul-loop:media-round-5-part-2 -->
## Board round 5 — screenshots and videos, part 2
Candidate `d2ee6467e23b84ffd7b5128fb993a614df68a7d2` · evidence `1459fd0b37554c88` · immutable media `b69dc3f7f93ddd7467c2057b56a974e60178b410`.
[Manifest](https://github.com/crvouga/gamezilla/blob/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/manifest.json) · [All screenshots](https://github.com/crvouga/gamezilla/blob/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/GALLERY.md) · [Before/after pairs](https://github.com/crvouga/gamezilla/blob/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/pairs) · [Exact outcomes and remaining gates](https://github.com/crvouga/gamezilla/blob/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/HANDOFF.md)
All 752 visual cases passed native readiness/play, browser-error and serious/critical axe stages. Eight font checks and the instrumented chess regression passed. Pixel comparisons, full bun verify, hosted safety and Ubuntu reference decisions are reported separately; no macOS references were accepted.
Round-four images are the before state. Runtime/play/axe, pixel comparisons, full local verification, hosted safety and canonical Ubuntu reference acceptance have separate verdicts in the manifest. No ratings, manual QA, merge or PR watch.
Recordings are automated assertion replays with recorder-only pacing, not natural user timing. The visible animated previews are sampled from the pinned WebM videos at 2 fps; click a preview for its complete recording. These are not GitHub inline video players. Phone 390×844 and desktop 1440×900 captures, both screenshot themes; native checks use desktop 1440×844.

### J8: QuoridorBoard
Move pawn and place/rotate valid wall; reach opposite edge

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-quoridor-classic--reach-opposite-edge--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-quoridor-classic--reach-opposite-edge--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-quoridor-classic--reach-opposite-edge--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-quoridor-classic--reach-opposite-edge--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-quoridor-classic--reach-opposite-edge--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-quoridor-classic--reach-opposite-edge--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-quoridor-classic--reach-opposite-edge--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-quoridor-classic--reach-opposite-edge--desktop--dark.png) |

**Checks:** 51 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 51 failed; no macOS acceptance.
**Limits:** Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification.

**Video — `screens-games-quoridor-classic--reach-opposite-edge`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-quoridor-classic--reach-opposite-edge--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-classic--reach-opposite-edge--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-classic--reach-opposite-edge--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-classic--reach-opposite-edge--desktop--light.webm)

**Video — `screens-games-quoridor-classic--place-a-wall`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-quoridor-classic--place-a-wall--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-classic--place-a-wall--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-classic--place-a-wall--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-classic--place-a-wall--desktop--light.webm)

**Video — `screens-games-quoridor-classic--precise-coordinates`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-quoridor-classic--precise-coordinates--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-classic--precise-coordinates--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-classic--precise-coordinates--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-classic--precise-coordinates--desktop--light.webm)

**Video — `screens-games-quoridor-classic--rotate-wall-preview`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-quoridor-classic--rotate-wall-preview--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-classic--rotate-wall-preview--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-classic--rotate-wall-preview--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-classic--rotate-wall-preview--desktop--light.webm)

### J9: QuoridorBoard
Move to hill, place walls and pass when required

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-quoridor-hill--reach-the-hill--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-quoridor-hill--reach-the-hill--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-quoridor-hill--reach-the-hill--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-quoridor-hill--reach-the-hill--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-quoridor-hill--reach-the-hill--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-quoridor-hill--reach-the-hill--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-quoridor-hill--reach-the-hill--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-quoridor-hill--reach-the-hill--desktop--dark.png) |

**Checks:** 43 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 43 failed; no macOS acceptance.
**Limits:** Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification.

**Video — `screens-games-quoridor-hill--reach-the-hill`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-quoridor-hill--reach-the-hill--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-hill--reach-the-hill--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-hill--reach-the-hill--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-hill--reach-the-hill--desktop--light.webm)

**Video — `screens-games-quoridor-hill--four-player-round`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-quoridor-hill--four-player-round--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-hill--four-player-round--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-hill--four-player-round--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-hill--four-player-round--desktop--light.webm)

**Video — `screens-games-quoridor-hill--pass-and-continue`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-quoridor-hill--pass-and-continue--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-hill--pass-and-continue--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-hill--pass-and-continue--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-hill--pass-and-continue--desktop--light.webm)

**Video — `screens-games-quoridor-hill--recover-wall-placement`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-quoridor-hill--recover-wall-placement--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-hill--recover-wall-placement--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-hill--recover-wall-placement--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-hill--recover-wall-placement--desktop--light.webm)

**Video — `screens-games-quoridor-hill--precise-coordinates`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-quoridor-hill--precise-coordinates--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-hill--precise-coordinates--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-hill--precise-coordinates--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-quoridor-hill--precise-coordinates--desktop--light.webm)

### J10: WordTilesBoardView
Place and submit valid word; blank assignment; exchange/pass; recover word-list failure

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-word-tiles-board--recover-and-submit--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-word-tiles-board--recover-and-submit--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-word-tiles-board--recover-and-submit--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-word-tiles-board--recover-and-submit--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-word-tiles-board--recover-and-submit--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-word-tiles-board--recover-and-submit--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-word-tiles-board--recover-and-submit--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-word-tiles-board--recover-and-submit--desktop--dark.png) |

**Checks:** 84 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 84 failed; no macOS acceptance.
**Limits:** Real resolveProposal/playEncoded fixture proves accepted CAT/score/turn, pass and exchange; retry is synchronous and does not prove asynchronous progress or live persistence.

**Video — `screens-games-word-tiles-board--recover-and-submit`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-word-tiles-board--recover-and-submit--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-board--recover-and-submit--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-board--recover-and-submit--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-board--recover-and-submit--desktop--light.webm)

**Video — `screens-games-word-tiles-board--accepted-pass`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-word-tiles-board--accepted-pass--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-board--accepted-pass--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-board--accepted-pass--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-board--accepted-pass--desktop--light.webm)

**Video — `screens-games-word-tiles-board--accepted-exchange`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-word-tiles-board--accepted-exchange--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-board--accepted-exchange--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-board--accepted-exchange--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-board--accepted-exchange--desktop--light.webm)

**Video — `screens-games-word-tiles-board--enlarged-coordinates`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-word-tiles-board--enlarged-coordinates--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-board--enlarged-coordinates--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-board--enlarged-coordinates--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-board--enlarged-coordinates--desktop--light.webm)

### J11: WordTilesPuzzlePlayerView
Place a word meeting puzzle target; recover invalid placement

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-word-tiles-puzzle--reach-target--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-word-tiles-puzzle--reach-target--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-word-tiles-puzzle--reach-target--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-word-tiles-puzzle--reach-target--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-word-tiles-puzzle--reach-target--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-word-tiles-puzzle--reach-target--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-word-tiles-puzzle--reach-target--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-word-tiles-puzzle--reach-target--desktop--dark.png) |

**Checks:** 44 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 44 failed; no macOS acceptance.
**Limits:** Production placement evaluator proves retained draft retry and target completion; live lexicon loading and persisted attempts remain outside this evidence.

**Video — `screens-games-word-tiles-puzzle--reach-target`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-word-tiles-puzzle--reach-target--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-puzzle--reach-target--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-puzzle--reach-target--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-puzzle--reach-target--desktop--light.webm)

**Video — `screens-games-word-tiles-puzzle--retry-word-list`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-word-tiles-puzzle--retry-word-list--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-puzzle--retry-word-list--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-puzzle--retry-word-list--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-puzzle--retry-word-list--desktop--light.webm)

**Video — `screens-games-word-tiles-puzzle--enlarged-blank`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-word-tiles-puzzle--enlarged-blank--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-puzzle--enlarged-blank--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-puzzle--enlarged-blank--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-word-tiles-puzzle--enlarged-blank--desktop--light.webm)

### J12: HeartsBoard
Select and pass three cards, then play legal card through trick

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-hearts-board--pass-through-first-trick--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-hearts-board--pass-through-first-trick--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-hearts-board--pass-through-first-trick--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-hearts-board--pass-through-first-trick--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-hearts-board--pass-through-first-trick--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-hearts-board--pass-through-first-trick--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-hearts-board--pass-through-first-trick--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-hearts-board--pass-through-first-trick--desktop--dark.png) |

**Checks:** 56 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 56 failed; no macOS acceptance.
**Limits:** Real legal-card rules drive accepted pass and first trick with rotating identities; a full hand/match and network acknowledgement remain unproven.

**Video — `screens-games-hearts-board--pass-through-first-trick`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-hearts-board--pass-through-first-trick--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-hearts-board--pass-through-first-trick--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-hearts-board--pass-through-first-trick--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-hearts-board--pass-through-first-trick--desktop--light.webm)

### J13: PongBoardView
Control paddle, return ball, score; resume after reconnect

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-pong-court--return-score-and-reconnect--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-pong-court--return-score-and-reconnect--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-pong-court--return-score-and-reconnect--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-pong-court--return-score-and-reconnect--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-pong-court--return-score-and-reconnect--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-pong-court--return-score-and-reconnect--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-pong-court--return-score-and-reconnect--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-pong-court--return-score-and-reconnect--desktop--dark.png) |

**Checks:** 48 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 48 failed; no macOS acceptance.
**Limits:** Controlled production-rule score/reconnect fixture. The separate real-physics production completion/rematch journey passed; live transport recovery is not established by this fixture.

**Video — `screens-games-pong-court--return-score-and-reconnect`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-pong-court--return-score-and-reconnect--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-pong-court--return-score-and-reconnect--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-pong-court--return-score-and-reconnect--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-pong-court--return-score-and-reconnect--desktop--light.webm)

### J14: LightCyclesBoardView
Steer safely, crash/round result; reconnect and resume

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-light-cycles-arena--collision-through-next-round--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-light-cycles-arena--collision-through-next-round--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-light-cycles-arena--collision-through-next-round--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-light-cycles-arena--collision-through-next-round--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-light-cycles-arena--collision-through-next-round--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-light-cycles-arena--collision-through-next-round--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/before/screens-games-light-cycles-arena--collision-through-next-round--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/after/screens-games-light-cycles-arena--collision-through-next-round--desktop--dark.png) |

**Checks:** 72 canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: 0 passed, 72 failed; no macOS acceptance.
**Limits:** Production step rules drive collision, result, next round and resumed steering; live transport reconnection remains unproven.

**Video — `screens-games-light-cycles-arena--collision-through-next-round`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-light-cycles-arena--collision-through-next-round--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-light-cycles-arena--collision-through-next-round--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-light-cycles-arena--collision-through-next-round--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-light-cycles-arena--collision-through-next-round--desktop--light.webm)

**Video — `screens-games-light-cycles-arena--resumed-steering`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-light-cycles-arena--resumed-steering--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-light-cycles-arena--resumed-steering--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-light-cycles-arena--resumed-steering--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-light-cycles-arena--resumed-steering--desktop--light.webm)

**Video — `screens-games-light-cycles-arena--shared-swipe`**
[![Play recorded phone journey](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/screens-games-light-cycles-arena--shared-swipe--phone--light.gif)](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-light-cycles-arena--shared-swipe--phone--light.webm)
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-light-cycles-arena--shared-swipe--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/b69dc3f7f93ddd7467c2057b56a974e60178b410/round-5/journeys/recordings/videos/screens-games-light-cycles-arena--shared-swipe--desktop--light.webm)

