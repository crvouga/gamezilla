# Word Tiles board market research

## Published gameplay screens

### Wordfeud · Bertheussen IT AS

![Wordfeud tablet board with FRIEND and GIVER crossing other plays, yellow tiles in CLOCK, and FRIENDS on the rack](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/94/f0/93/94f093a2-2745-d7e0-ea69-16d28bab677b/iPad_Pro_13_Display-01.png/360x480bb.jpg)

*Wordfeud, iPad. The publisher's first App Store screenshot shows all four bonus labels, intersecting words and the seven-tile rack. Accessed 2026-11-25.* [Publisher listing](https://apps.apple.com/us/app/wordfeud/id428312806) · [Game rules](https://wordfeud.com/wf/help/)

### Crosswords · xwords project (eehouse)

![Crosswords PocketPC board with YESHIVAS running down the center, contrasting tiles along the bottom and two tiles in the tray](https://xwords.sourceforge.io/img/wince/wincemain.png)

*Crosswords, PocketPC. The illustrated manual identifies the V in the vertical YESHIVAS as an assigned blank. The tray holds N and D beside a 30-point counter. This historical screenshot documents the PocketPC rendering.* [Developer's board manual, accessed 2026-11-25](https://xwords.sourceforge.io/cemainbrd.php.html) · [Project repository](https://github.com/eehouse/xwords)

### Quackle · Jason Katz-Brown, John O'Laughlin and the Quackle team

![Quackle desktop match between David Sutton and Darryl Francis, with an A E F rack, a proposed move worth five points and a boxed W in TIGERWOOD](https://people.csail.mit.edu/jasonkb/quackle/images/quackle-0.97.png)

*Quackle 0.97, desktop. The release screenshot shows a saved game at turn ten. The pending entry reads “D12 FAE#”, with “+5” beside the commit button. On row six, the W in TIGERWOOD has an inner frame.* [Developer's release page, accessed 2026-11-25](https://people.csail.mit.edu/jasonkb/quackle/)

## What a player can read

| Player task | Wordfeud | Crosswords (PocketPC) | Quackle 0.97 |
| --- | --- | --- | --- |
| Find a scoring opportunity | Empty colored cells carry DL, TL, DW or TW. The rules expand each abbreviation. | Empty bonus cells have solid fills. The manual documents holding the pen on a square to read its multiplier. | Empty colored cells show 2LS, 3LS, 2WS or 3WS. Both the number and the affected unit appear on the square. |
| Find the rack and distinguish a draft from earlier plays | A dark strip separates the rack from the grid. Four yellow tiles and an off-white crossing C form CLOCK. The screenshot alone leaves the meaning of yellow unresolved. | The tray sits below the grid. The manual says its points counter appears as soon as a tile leaves the tray. It separately identifies reversed lettering as the most recent move. | The rack sits outside the grid. FAE appears in the move-entry field with an explicit commit action. The history records earlier moves. The pictured position establishes a draft in the field, without establishing how a dragged draft looks on the grid. |
| Identify a blank after assignment | Help says the player assigns a letter on placement and the tile scores zero. The screenshot does not identify a particular played blank. | The manual names the played V and describes the small vertical marks in the tile corners. A player can read the chosen letter and still identify the tile as a blank. | The history spells the play as TIGERwOOD and the matching W on the board has an inner frame. The matching lowercase letter and frame suggest blank identity. That interpretation is an inference from the two views. |

## Board design decisions

- **Print the multiplier and its scope on every uncovered bonus.** Wordfeud's DL and DW share a multiplier but affect different things. A visible label lets a player distinguish them before placing a tile. Use the accessible cell name to spell out “double letter” or “double word”.
- **Mark the tiles the player can still move.** In Wordfeud's CLOCK, a highlighted run includes an ordinary crossing tile. For Word Tiles, give each tentative tile a consistent edge treatment and leave the committed crossing tile in its usual style. A player deciding what to retract needs tile-level information even when a preview shows the score for the whole word.
- **Keep blank identity through submission.** Preserve the assigned glyph for reading the word, display a zero in the tile's point position, and include “blank assigned [letter], zero points” in its accessible name. The documented V in YESHIVAS illustrates when this matters: a player scoring a later crossing must distinguish that V from an ordinary V. Use a separate treatment for tentative status so committing the move can clear that treatment while the zero remains.

## Decisions and verification, 2026-11-25

The board prints 2L, 3L, 2W and 3W on its bonus squares. Draft letters have individual dashed edges, so the letters a player can retract remain distinguishable within a crossing word. The first round exercised placement, retraction and submission across two-, three- and four-player tables. Hosted results and board captures (PR #576, comment 7158965534)

The marked blank in the Crosswords manual prompted a change for small boards. Word Tiles underlines the assigned letter in both the draft and the committed word. Precision view also shows the zero-point value. Fit can hide point numerals to make room for the letters. The assigned-blank check exercises a three-player match through submission and compares the blank A with an ordinary C. [Hosted board checks](../../../pkgs/ui-root-harness-ts/tests/storybook/word-tiles-gestures/integration.checks.ts)

The player can pick up a rack tile and drop it onto a magnified square. Starting on the board instead lets the player inspect a crossing by panning or zooming. The phone and desktop checks exercise these actions, including interrupted drops, return to Fit and reduced motion. This interaction follows the board brief; the competitor screenshots establish appearance only.

**Open question.** Can a first-time player recognize the underline alone as a blank in Fit? Automated checks establish that the mark persists and the accessible name identifies the blank. Recognition by players remains unmeasured.

## Returning to a game after time away

Words With Friends, published by Zynga. These two phone screenshots were supplied on 2026-11-26 and show the same match before and after opening it.

![Your Move list showing an opponent, AERIE in letter tiles, a 0 vs 10 score and the time since play](words-with-friends-your-move.png)

*The first match under “Your Move” shows who played, the word they made, its ten-point value and how recently they played.*

![Word game with scores above the grid, AERIE across the center and seven gold letter tiles above the Play button](words-with-friends-board.png)

*Opening the match carries AERIE through to the board. A strip above the grid names the player, word and points. The gold rack tiles have raised edges, large letters and small corner values. Colored bonus squares carry short labels.*

Use this pair as the visual reference for Word Tiles on phones. Give the board most of the width, keep the empty grid quiet, and give the rack tiles enough depth and contrast to read as pieces a player can pick up. Keep the turn controls within reach below the rack.

For long-running Word Tiles and chess games, carry the opponent and latest move from the game list into the open match. A returning player can then recognize the game and find what changed. For chess, the equivalent of the word preview is the opponent’s move and its marked squares. The screenshots leave open how a game waiting on the opponent should appear.
