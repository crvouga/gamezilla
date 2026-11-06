<!-- overhaul-loop:media-round-3-part-2 -->
## Board round 3 — screenshots and videos, part 2
Candidate `897a7562d2fee9d4cec187281ac84119de322c05` · evidence `71631a78b947264a`.
[Manifest](https://github.com/crvouga/gamezilla/blob/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/manifest.json) · [Screenshot gallery](https://github.com/crvouga/gamezilla/blob/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/GALLERY.md) · [Before/after pairs](https://github.com/crvouga/gamezilla/blob/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/pairs) · [Exhaustive story inventory](https://github.com/crvouga/gamezilla/blob/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/story-inventory.json) · [Journey limits](https://github.com/crvouga/gamezilla/blob/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/mapping.json)
All 620 visual cases passed native readiness/play, browser-error and serious/critical axe stages; all 8 controlled font checks passed. Local pixel comparisons remain separate and no macOS references were accepted. Full bun verify failed the pre-existing /more/troubleshooting statechart-owner rule. Hosted verify:end also failed the Numberlink library-navigation journey before board interaction. Two new independent reviews remain pending. Final-head Ubuntu reference authoring succeeded; comparison is still running in run 42255354537. No references are accepted, and pixel approval remains pending. The historical Ubuntu phone drift is not retroactively explained by current controlled-pair stability.
Automated Storybook only. No manual QA, ratings or merge. Videos use native Storybook assertion checkpoints with recorder-only pacing. These are pinned WebM links, not embedded video players. Before images are immutable round-2 captures; absent-before states are explicit. Test viewports: 390×844 and 1440×844; gallery viewports: 390×844 and 1440×900.

<details><summary>J8: QuoridorBoard — Move pawn and place/rotate valid wall; reach opposite edge</summary>

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-quoridor-classic--reach-opposite-edge--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-quoridor-classic--reach-opposite-edge--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-quoridor-classic--reach-opposite-edge--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-quoridor-classic--reach-opposite-edge--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-quoridor-classic--reach-opposite-edge--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-quoridor-classic--reach-opposite-edge--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-quoridor-classic--reach-opposite-edge--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-quoridor-classic--reach-opposite-edge--desktop--dark.png) |

**Checks:** 42 canonical cases passed readiness/play, browser-error and serious/critical axe stages. Pixels: 0 passed, 42 failed; no macOS acceptance.
**Limits:** Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification.

**Automated journey:** `screens-games-quoridor-classic--reach-opposite-edge`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-quoridor-classic--reach-opposite-edge--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-quoridor-classic--reach-opposite-edge--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-quoridor-classic--reach-opposite-edge--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-quoridor-classic--reach-opposite-edge--phone--light.webm)

**Automated journey:** `screens-games-quoridor-classic--place-a-wall`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-quoridor-classic--place-a-wall--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-quoridor-classic--place-a-wall--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-quoridor-classic--place-a-wall--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-quoridor-classic--place-a-wall--phone--light.webm)

</details>

<details><summary>J9: QuoridorBoard — Move to hill, place walls and pass when required</summary>

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-quoridor-hill--reach-the-hill--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-quoridor-hill--reach-the-hill--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-quoridor-hill--reach-the-hill--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-quoridor-hill--reach-the-hill--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-quoridor-hill--reach-the-hill--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-quoridor-hill--reach-the-hill--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-quoridor-hill--reach-the-hill--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-quoridor-hill--reach-the-hill--desktop--dark.png) |

**Checks:** 37 canonical cases passed readiness/play, browser-error and serious/critical axe stages. Pixels: 0 passed, 37 failed; no macOS acceptance.
**Limits:** Storybook exercises production components and deterministic fixture rules; live transport and persisted cross-session recovery are outside this board-only verification.

**Automated journey:** `screens-games-quoridor-hill--reach-the-hill`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-quoridor-hill--reach-the-hill--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-quoridor-hill--reach-the-hill--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-quoridor-hill--reach-the-hill--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-quoridor-hill--reach-the-hill--phone--light.webm)

**Automated journey:** `screens-games-quoridor-hill--four-player-round`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-quoridor-hill--four-player-round--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-quoridor-hill--four-player-round--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-quoridor-hill--four-player-round--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-quoridor-hill--four-player-round--phone--light.webm)

**Automated journey:** `screens-games-quoridor-hill--pass-and-continue`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-quoridor-hill--pass-and-continue--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-quoridor-hill--pass-and-continue--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-quoridor-hill--pass-and-continue--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-quoridor-hill--pass-and-continue--phone--light.webm)

**Automated journey:** `screens-games-quoridor-hill--recover-wall-placement`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-quoridor-hill--recover-wall-placement--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-quoridor-hill--recover-wall-placement--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-quoridor-hill--recover-wall-placement--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-quoridor-hill--recover-wall-placement--phone--light.webm)

</details>

<details><summary>J10: WordTilesBoardView — Place and submit valid word; blank assignment; exchange/pass; recover word-list failure</summary>

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-word-tiles-board--recover-and-submit--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-word-tiles-board--recover-and-submit--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-word-tiles-board--recover-and-submit--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-word-tiles-board--recover-and-submit--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-word-tiles-board--recover-and-submit--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-word-tiles-board--recover-and-submit--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-word-tiles-board--recover-and-submit--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-word-tiles-board--recover-and-submit--desktop--dark.png) |

**Checks:** 71 canonical cases passed readiness/play, browser-error and serious/critical axe stages. Pixels: 0 passed, 71 failed; no macOS acceptance.
**Limits:** Real resolveProposal/playEncoded fixture proves accepted CAT/score/turn, pass and exchange; retry is synchronous and does not prove asynchronous progress or live persistence.

**Automated journey:** `screens-games-word-tiles-board--recover-and-submit`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-word-tiles-board--recover-and-submit--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-word-tiles-board--recover-and-submit--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-word-tiles-board--recover-and-submit--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-word-tiles-board--recover-and-submit--phone--light.webm)

**Automated journey:** `screens-games-word-tiles-board--accepted-pass`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-word-tiles-board--accepted-pass--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-word-tiles-board--accepted-pass--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-word-tiles-board--accepted-pass--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-word-tiles-board--accepted-pass--phone--light.webm)

**Automated journey:** `screens-games-word-tiles-board--accepted-exchange`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-word-tiles-board--accepted-exchange--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-word-tiles-board--accepted-exchange--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-word-tiles-board--accepted-exchange--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-word-tiles-board--accepted-exchange--phone--light.webm)

**Automated journey:** `screens-games-word-tiles-board--enlarged-coordinates`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-word-tiles-board--enlarged-coordinates--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-word-tiles-board--enlarged-coordinates--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-word-tiles-board--enlarged-coordinates--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-word-tiles-board--enlarged-coordinates--phone--light.webm)

</details>

<details><summary>J11: WordTilesPuzzlePlayerView — Place a word meeting puzzle target; recover invalid placement</summary>

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-word-tiles-puzzle--reach-target--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-word-tiles-puzzle--reach-target--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-word-tiles-puzzle--reach-target--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-word-tiles-puzzle--reach-target--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-word-tiles-puzzle--reach-target--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-word-tiles-puzzle--reach-target--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-word-tiles-puzzle--reach-target--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-word-tiles-puzzle--reach-target--desktop--dark.png) |

**Checks:** 34 canonical cases passed readiness/play, browser-error and serious/critical axe stages. Pixels: 0 passed, 34 failed; no macOS acceptance.
**Limits:** Production placement evaluator proves retained draft retry and target completion; live lexicon loading and persisted attempts remain outside this evidence.

**Automated journey:** `screens-games-word-tiles-puzzle--reach-target`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-word-tiles-puzzle--reach-target--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-word-tiles-puzzle--reach-target--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-word-tiles-puzzle--reach-target--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-word-tiles-puzzle--reach-target--phone--light.webm)

</details>

<details><summary>J12: HeartsBoard — Select and pass three cards, then play legal card through trick</summary>

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-hearts-board--pass-through-first-trick--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-hearts-board--pass-through-first-trick--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-hearts-board--pass-through-first-trick--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-hearts-board--pass-through-first-trick--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-hearts-board--pass-through-first-trick--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-hearts-board--pass-through-first-trick--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-hearts-board--pass-through-first-trick--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-hearts-board--pass-through-first-trick--desktop--dark.png) |

**Checks:** 53 canonical cases passed readiness/play, browser-error and serious/critical axe stages. Pixels: 0 passed, 53 failed; no macOS acceptance.
**Limits:** Real legal-card rules drive accepted pass and first trick with rotating identities; a full hand/match and network acknowledgement remain unproven.

**Automated journey:** `screens-games-hearts-board--pass-through-first-trick`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-hearts-board--pass-through-first-trick--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-hearts-board--pass-through-first-trick--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-hearts-board--pass-through-first-trick--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-hearts-board--pass-through-first-trick--phone--light.webm)

</details>

<details><summary>J13: PongBoardView — Control paddle, return ball, score; resume after reconnect</summary>

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-pong-court--return-score-and-reconnect--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-pong-court--return-score-and-reconnect--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-pong-court--return-score-and-reconnect--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-pong-court--return-score-and-reconnect--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-pong-court--return-score-and-reconnect--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-pong-court--return-score-and-reconnect--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-pong-court--return-score-and-reconnect--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-pong-court--return-score-and-reconnect--desktop--dark.png) |

**Checks:** 48 canonical cases passed readiness/play, browser-error and serious/critical axe stages. Pixels: 0 passed, 48 failed; no macOS acceptance.
**Limits:** Controlled production-rule score/reconnect fixture; live real-time transport recovery remains unproven.

**Automated journey:** `screens-games-pong-court--return-score-and-reconnect`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-pong-court--return-score-and-reconnect--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-pong-court--return-score-and-reconnect--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-pong-court--return-score-and-reconnect--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-pong-court--return-score-and-reconnect--phone--light.webm)

</details>

<details><summary>J14: LightCyclesBoardView — Steer safely, crash/round result; reconnect and resume</summary>

| View | Before | After |
|---|---|---|
| phone · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-light-cycles-arena--collision-through-next-round--phone--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-light-cycles-arena--collision-through-next-round--phone--light.png) |
| phone · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-light-cycles-arena--collision-through-next-round--phone--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-light-cycles-arena--collision-through-next-round--phone--dark.png) |
| desktop · light | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-light-cycles-arena--collision-through-next-round--desktop--light.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-light-cycles-arena--collision-through-next-round--desktop--light.png) |
| desktop · dark | ![Before](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/before/screens-games-light-cycles-arena--collision-through-next-round--desktop--dark.png) | ![After](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/after/screens-games-light-cycles-arena--collision-through-next-round--desktop--dark.png) |

**Checks:** 72 canonical cases passed readiness/play, browser-error and serious/critical axe stages. Pixels: 0 passed, 72 failed; no macOS acceptance.
**Limits:** Production step rules drive collision, result, next round and resumed steering; live transport reconnection remains unproven.

**Automated journey:** `screens-games-light-cycles-arena--collision-through-next-round`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-light-cycles-arena--collision-through-next-round--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-light-cycles-arena--collision-through-next-round--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-light-cycles-arena--collision-through-next-round--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-light-cycles-arena--collision-through-next-round--phone--light.webm)

**Automated journey:** `screens-games-light-cycles-arena--resumed-steering`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-light-cycles-arena--resumed-steering--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-light-cycles-arena--resumed-steering--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-light-cycles-arena--resumed-steering--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-light-cycles-arena--resumed-steering--phone--light.webm)

**Automated journey:** `screens-games-light-cycles-arena--shared-swipe`
[Phone WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-light-cycles-arena--shared-swipe--phone--light.webm) · [Desktop WebM](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-light-cycles-arena--shared-swipe--desktop--light.webm)
[![Recorded journey thumbnail](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/screens-games-light-cycles-arena--shared-swipe--phone--light.png)](https://raw.githubusercontent.com/crvouga/gamezilla/83eb5031f5daca91f63c55d0801fb7326d371f23/round-3/journeys/recordings/videos/screens-games-light-cycles-arena--shared-swipe--phone--light.webm)

</details>

