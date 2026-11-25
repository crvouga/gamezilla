# Connect Four board market research

A player faces two spatial questions on each turn. Which column am I choosing, and where will my disc stop? At the end of a round, the question changes to which four discs won. The three published game screens below give different answers.

All source pages and direct images were accessed on **2026-11-25**. Each image returned HTTP 200, decoded at the dimensions given, and showed a playable product's board with placed discs. The links point to publisher or distributor media. Observations describe the pictured frames. Where a publisher documents an interaction, the text identifies that evidence separately.

## KFourInLine · KDE

![KFourInLine showing seven arrows above a blue board and a red disc at the foot of the fourth column.][kde-image]

*KDE's desktop gameplay screenshot, 674 × 539.* [Direct screenshot][kde-image] · [KDE product page][kde-page]

Seven downward arrows align with the seven columns. The fourth arrow is red, the other six green. A red disc rests at the bottom of column four. This makes the relation between the top entry and bottom landing easy to trace on an almost empty board. The frame does not establish whether the red arrow follows the pointer, marks the previous move, or has another meaning.

The side panel names “Player 1” and “Level 2” and gives each a column of figures. Hint and Undo sit in the toolbar outside the grid. The screen shows a settled piece but no trajectory, projected landing cell, explicit turn sentence, or completed win. A permanently aligned marker for each column is worth borrowing as an arrangement, but the chosen column needs a cue beyond a change from green to red.

## Four-in-a-row · The GNOME Project

![GNOME Four-in-a-row showing star and crescent discs on a black grid beneath the result You win!][gnome-image]

*The GNOME Project's finished-game screenshot, 700 × 447, distributed by Flathub.* [Direct screenshot][gnome-image] · [Flathub product page][gnome-page] · [Upstream screenshot metadata][gnome-meta]

The pieces have distinct interior marks, a star and a crescent, so a reader can distinguish the two sets even without naming their colors. “You win!” identifies the outcome from the player's perspective. Start Over remains visible beside the board and Hint appears dimmed. The final layout remains readable. Several diagonals are plausible at a glance, and there is no distinct winning-line treatment visible in this frame.

GNOME's controls guide documents left and right to position a marble and down to drop it. That distinction between choosing and committing is documented behavior. The finished-game image cannot establish how the choice looks before a drop, whether a landing cell is previewed, or which seat played last. [GNOME controls guide][gnome-controls]

## Four In A Line · AI Factory Limited

![AI Factory's portrait game showing YOU WIN above a wooden board, four highlighted horizontal discs and a You versus CPU score strip.][ai-image]

*AI Factory Limited's Android gameplay screenshot, 333 × 592, from its Google Play listing.* [Direct screenshot][ai-image] · [Google Play product page][ai-page]

The result occupies the space above the rack. Four adjacent dark discs in the fourth row from the top, columns three through six, carry bright center marks and surrounding sparks. The player can locate the win on the board below “YOU WIN!” The strip below the rack pairs “You” and “CPU (6)” with disc-colored scores. The same frame answers who won, where, and how the running score stands.

The bright marks partly cover the winning discs' original finish. This suggests using an outline or center mark that preserves seat identity underneath it. The board shows the settled arrangement. Column selection, landing preview, touch target size, spark motion and the duration of the result cannot be determined from this image.

## Opportunities for this board

| Player question | Design opportunity | Observable acceptance criterion |
| --- | --- | --- |
| Which column am I about to play? | Put one focus marker above the chosen column, aligned with its center. Give it a shape as well as a color. | Moving the keyboard choice one column moves the marker one column and leaves the disc count unchanged. |
| Where will the disc stop? | Pair the entry marker with a hollow marker in the lowest free cell. Render a full column as unavailable. | In a column containing three discs, the marker sits immediately above the third disc. A full column has no landing marker. |
| Which pieces are mine, and whose turn is it? | Repeat a seat symbol on the discs and beside the player name. Use explicit turn text for players and spectators. | Both seats remain distinguishable in monochrome. A spectator can identify the active player without interpreting “You.” |
| What changed after the drop? | Mark the newly settled disc briefly or until the next move. Make its treatment distinct from both the hollow preview and the winning line. | After a nonwinning move the last-disc mark sits on the newly occupied cell, and the turn label names the next player. |
| What ended the round? | Keep the final board exposed, name the winner and mark the winning run directly on its discs. | On horizontal, vertical and diagonal wins the marked cells explain the result with motion disabled. A draw has result text and no winning marks. |

These are design proposals, not claims about features shared by the competitors. The sample includes two desktop products and one Android product. Only GNOME's input mapping was corroborated from a controls guide. The stills do not establish actual hit areas, interaction timing, sound, assistive-technology announcements, or recovery from a rejected move.

[kde-page]: https://apps.kde.org/kfourinline/
[kde-image]: https://cdn.kde.org/screenshots/kfourinline/kfourinline.png
[gnome-page]: https://flathub.org/en/apps/org.gnome.Four-in-a-row
[gnome-image]: https://dl.flathub.org/media/org/gnome/Four-in-a-row/94c48b1fedda2a8884ffed433dc7fe6c/screenshots/image-1_orig.png
[gnome-meta]: https://github.com/GNOME/four-in-a-row/blob/master/data/org.gnome.Four-in-a-row.metainfo.xml.in
[gnome-controls]: https://help.gnome.org/four-in-a-row/controls-default.html
[ai-page]: https://play.google.com/store/apps/details?id=uk.co.aifactory.fialfree&hl=en
[ai-image]: https://play-lh.googleusercontent.com/nbHZjEe8he9wl2nUd7KC8fWP2X7Xkq1sEMolOC19eHAihMKWAqeeQcKm4YBfPDJqabzmsQbEq3FjYvF38_1fYA=w1052-h592

## Applied to the playable rack

KDE's aligned arrows informed the single entry marker that follows a held disc across the column numbers. The marker fills on pickup and stays aligned with the hollow landing well as the finger moves. Release commits the chosen column. GNOME's documented distinction between positioning and dropping also applies to the keyboard controls. The circle and diamond remain visible after placement and inside the winning rings, preserving seat identity during the on-board result emphasis visible in AI Factory's example.

The seven-column rack fits as a whole for normal play. Pinching suspends the pending drop and enlarges the columns around the midpoint. In this view one pointer pans, and the Fit board control restores play. A magnified move requires an explicit return to fit because the same drag already means pan. These choices concern this implementation. The competitor stills provide no gesture or latency comparison.

## Verification and open questions

On 2026-11-25 the first round’s hosted phone and desktop captures showed the landing preview, placed disc and winning rings. The second round adds native input checks for sliding across columns, release, cancellation, pinch, panning and returning to fit. Its scoped checks and 20 board DOM tests passed. Hosted gesture and timing results are pending for board revision `a740e9295b`. [Round-one board captures](https://github.com/crvouga/gamezilla/pull/574#issuecomment-7158876733) · [Gesture and performance diagnostic](https://github.com/crvouga/gamezilla/actions/runs/45593872333)

- Can a player locate the winning four quickly on a crowded diagonal while still identifying each seat? The round-one images show a vertical win.
- Does a player trying to place a disc after magnifying the rack discover Fit board? The hosted input checks exercise that path. Discoverability needs evidence from players.
- How does sliding feel on physical phones and trackpads? The hosted measurements use emulated inputs. Record the device, input and board revision when physical-device evidence becomes available.

Refresh the affected comparison here when a publisher changes its board or when a Connect Four interaction changes. Date the new observation and link it to the resulting decision and verification.
