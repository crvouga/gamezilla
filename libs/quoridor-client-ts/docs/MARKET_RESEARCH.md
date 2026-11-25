# Quoridor board market research

A player chooses between two kinds of space on a flat Quoridor board. A pawn lands **inside a square**. A wall occupies **the gap between squares** and spans two of them. Three independently published games illustrate different ways to make that choice. The captions describe the publishers' images. Interaction details come from their instructions. All three sources and their images were accessed on November 25, 2026.

## quoridor.py by Alain Rinder, with Pierre Rinder

![Four lettered pawns on pale squares with thin colored walls between them](https://raw.githubusercontent.com/alainrinder/quoridor.py/7bbc80f62ad8e5cb6a98fa2948c7975903e2eaf8/img/Screenshot.png)

*Alain Rinder's four-player board. A, B, C and D appear inside colored discs. Each wall runs along a grid line. The screenshot is 322 by 344 pixels.*

The letters identify pawns even when their colors are hard to distinguish. The narrow walls leave the cell interiors clear, but the wall's visible edge gives little indication of where a click will register. The published controls explain the missing interaction. Press **P** to reveal possible pawn destinations, then click a square to move. Press **F** to reveal possible fence positions. Clicking between stacked squares places a horizontal fence that extends right. Clicking between side-by-side squares places a vertical fence that extends down. The instructions describe placement on click and give no cancellation gesture. The image shows neither the destination markers nor a marked goal. [Project, controls and screenshot](https://github.com/alainrinder/quoridor.py/tree/7bbc80f62ad8e5cb6a98fa2948c7975903e2eaf8)

## Quoridor Online by Quentin Deschamps

![Four lettered pawns, colored walls inside the grid, and a different color along each outside edge](https://raw.githubusercontent.com/Quentin18/Quoridor-Online/56519bf60a92327e7c309d66f4f9e566de406e54/img/capture.png)

*Quentin Deschamps's four-player Pygame client. The red Q matches Quentin in the player list. Red also runs across the bottom edge. The board contains walls in both orientations.*

The letters and adjacent names connect pawns to people. The colored perimeter could associate each player with an edge, but the image supplies no arrow or label that distinguishes a starting edge from a goal. The perimeter also uses the same colors and straight strokes as the walls. Deschamps documents arrow keys for moving a pawn and a board click for placing a fence. How the player selects the orientation, whether destinations appear before the move, and whether a pending placement can be cancelled are unspecified. [Project, controls and screenshot](https://github.com/Quentin18/Quoridor-Online/tree/56519bf60a92327e7c309d66f4f9e566de406e54)

## Zoridor by Ringtail Software

![Animated game board with colored square pawns, white fences and coordinates outside the grid](https://raw.githubusercontent.com/ringtailsoftware/zoridor/960df4f73236654226bf8fad1f578d379c6b23a8/doc/demo.gif)

*Ringtail Software's gameplay recording. White bars span pairs of dark squares on a blue grid. Coordinates sit outside the playing area. The recording includes a machine-versus-machine position.*

The white bars make orientation and span visible without reference to pawn color. The publisher documents a separate preview and commit step for the **terminal version**. Arrow keys choose a destination. Brackets identify the candidate square, and green or red indicates validity. Enter commits the move. Tab switches to fence mode, arrow keys position the fence, Space rotates it, and Enter places it. This lets the player correct an orientation before spending a fence. The instructions give no explicit cancel command. They name the opposite edge as the objective for each player. The recording does not establish how the web version handles touch. [Publisher's recording and terminal controls](https://github.com/ringtailsoftware/zoridor/tree/960df4f73236654226bf8fad1f578d379c6b23a8) · [Playable web version](https://ringtailsoftware.github.io/zoridor/)

## Decisions and verification

Reviewed November 25, 2026. The comparison informed three choices for Classic and Hill.

| Player task | Decision on our board | Evidence |
| --- | --- | --- |
| Find a pawn and choose a destination. | Keep the pawn's seat-specific shape visible and mark legal destinations with open rings. Keyboard focus has its own outline. A player can drag the pawn onto a legal square. | The Classic pawn identity and keyboard story passed in the first hosted round. The opening captures show the pawn and rings at their native board sizes. |
| Try a wall without spending it. | Let the player select a square as an anchor and see both gaps the proposed wall spans. Rotation keeps that anchor. A separate confirmation spends the wall. A finger can slide the preview between anchors. | The first hosted round exercised horizontal and vertical proposals, refusal, cancellation and placement. The matched clips show native rotation and cancellation. |
| Tell a destination from a wall. | Classic marks the goal row with a finish stripe. Hill marks e5 with a star and contours that remain beneath the winning pawn. The Hill objective comes from our own rules. | The hosted Classic and Hill journeys reached their respective goals. Opening screenshots show the two objective treatments on desktop and phone. |

[Matched board-only screenshots and wall-editing clips](https://github.com/crvouga/gamezilla/pull/582#issuecomment-7159242344) · [Hosted Classic and Hill checks](https://github.com/crvouga/gamezilla/actions/runs/45589092120/job/139118252086) · [Classic production stories](../src/quoridor-board.stories.tsx) · [Hill production stories](../src/quoridor-board-hill.stories.tsx)

## Gesture evidence

On November 25, 2026, the hosted Hill phone story at 390 × 844 and Classic desktop story at 1440 × 1024 both passed. On the phone, adding a second finger magnified the position around the pinch midpoint and kept the pawn on e1. On desktop, the wheel gesture preserved the focal square. Both stories then panned, selected a wall preview on the transformed board, returned to fit, cancelled a wall and dragged the pawn to e2. The phone also cancelled an interrupted pawn drag. Both verified the 140 ms landing animation with system motion enabled and its absence with reduced motion. [Board-only recordings, screenshots and timing samples](https://github.com/crvouga/gamezilla/pull/582#issuecomment-7164970146) · [Hosted gesture and regression checks](https://github.com/crvouga/gamezilla/actions/runs/45615054947/job/139208195052)

## Open questions

Does the four-square highlight make a wall's anchor clear while a fingertip covers the gap on a physical phone? The publisher captures show walls after placement. Our hosted phone recording verifies targeting and cancellation, but cannot establish what a person's finger obscures.
