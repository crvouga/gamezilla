# Numberlink board market research

A player needs to find two matching endpoints before drawing, locate the loose end while correcting a path, and tell when the puzzle is complete. Four publisher screenshots show how those tasks differ. All images and listings below were accessed on 2026-11-25. Each image link returned HTTP 200 with an image content type and opened as a gameplay screenshot. Interaction descriptions come from the listings. Still images give no measure of touch accuracy, keyboard access, or screen-reader behavior.

## Flow Free by Big Duck Games LLC

![Level 12, one cell short.](https://is1-ssl.mzstatic.com/image/thumb/Purple113/v4/d2/17/8f/d2178f92-adbb-c03f-29a6-45aa3d097e4b/contsched.cuhuxoym.png/392x696bb.png)

*Level 12, one cell short.* Four pipes join pairs of round endpoints. The blue pipe stops one cell above its matching dot. A translucent disk surrounds its loose end. The text above the board reads “flows: 4/5” and “pipe: 95%”. Those two figures convey different kinds of progress without color. The ten endpoint disks in this image carry no labels. [Publisher screenshot](https://is1-ssl.mzstatic.com/image/thumb/Purple113/v4/d2/17/8f/d2178f92-adbb-c03f-29a6-45aa3d097e4b/contsched.cuhuxoym.png/392x696bb.png) · [App Store listing](https://apps.apple.com/us/app/flow-free/id526641427)

The publisher documents optional labels for color-impaired players and says crossing or overlapping a pipe breaks it. The image shows the location of the loose end. It does not show what survives a crossing or how a broken pipe is restored. [Publisher rules](https://www.bigduckgames.com/flowfree) · [Publisher description of labels](https://apps.apple.com/us/app/flow-free/id526641427)

## NumberLink 2000+ by 毅 郑

![Level 37, six numbered pairs.](https://is1-ssl.mzstatic.com/image/thumb/Purple113/v4/78/bd/2f/78bd2fdf-5440-d0ce-c166-de1b86d8548e/mzl.mpfherxo.png/392x696bb.png)

*Level 37, six numbered pairs.* Both ends of the straight path across the top have a square marked 5. The two squares marked 1 share a short vertical line. A player can verify either match by reading the endpoints and following the line. The thin paths leave enough of each cell exposed to see the grid. Above the board, “moves: 6” reports effort. The image shows no explicit win message. [Publisher screenshot](https://is1-ssl.mzstatic.com/image/thumb/Purple113/v4/78/bd/2f/78bd2fdf-5440-d0ce-c166-de1b86d8548e/mzl.mpfherxo.png/392x696bb.png) · [App Store listing](https://apps.apple.com/us/app/numberlink-2000/id659184040)

The listing asks players to fill the board without crossing lines. It advertises step hints and solutions. The arrow icons in this screenshot have no captions, so their effect on an existing path is uncertain.

## NumberLink: Connect Numbers by 建明 顾

![Five pairs joined on a full six-by-six board.](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/87/24/5e/87245e5e-5647-a441-265d-f2207a0f7b40/8b95535d-bcfc-4d25-8951-dba4c6280f22_Simulator_Screen_Shot_-_iPhone_8_Plus_-_2022-09-02_at_19.03.26.png/392x696bb.png)

*Five pairs joined on a full six-by-six board.* A narrow stroke connects each pair of numbered disks. A pale band fills the cells beneath each stroke. The stroke shows the route through a turn, while the band shows which cells it occupies. “Numbers:5/5” and “Filled: 100%” confirm both conditions in text. The white 2 on its yellow disk has visibly less contrast than the white 3 on blue. [Publisher screenshot](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/87/24/5e/87245e5e-5647-a441-265d-f2207a0f7b40/8b95535d-bcfc-4d25-8951-dba4c6280f22_Simulator_Screen_Shot_-_iPhone_8_Plus_-_2022-09-02_at_19.03.26.png/392x696bb.png) · [App Store listing](https://apps.apple.com/us/app/numberlink-connect-numbers/id1642847054)

The publisher describes swiping to extend, cut through, and redraw paths, with undo and redo. Those are documented operations. This screenshot shows their possible end state, with no evidence of their timing or feedback during a correction.

## Numberlink: ConnectLine by Huy Huynh

![Level 1 with a win message.](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/3c/8d/ae/3c8dae36-f3b1-3a2a-eaf9-7b93df9b74c3/localhost_58114__U0028iphone_U0029.png/320x480bb.jpg)

*Level 1 with a win message.* Each path ends in two numbered squares. The 3 and 4 paths run beside each other near the center, where their endpoint digits help distinguish the two dark purple hues. “That’s a win!” appears near the bottom of the screen, separated from the grid by a large blank area. The words communicate completion without hue, although the small type and distance make the message easy to overlook. [Publisher screenshot](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/3c/8d/ae/3c8dae36-f3b1-3a2a-eaf9-7b93df9b74c3/localhost_58114__U0028iphone_U0029.png/320x480bb.jpg) · [App Store listing](https://apps.apple.com/us/app/numberlink-connectline/id6753098733)

The publisher describes joining matching numbers without crossing, filling the board, and saving a victory automatically. The listing gives no correction gesture. The still image establishes a visible win message, not how the board responds to a mistaken move.

## Comparing board tasks

| Player task | Board decision | Proposed automated evidence |
| --- | --- | --- |
| Find the matching endpoint | Keep the same legible label at both endpoints after a path covers them. Several publishers keep digits visible on connected paths. | Use `DenseBoardHalfDrawn`, where all twenty pairs share the same blue hue. Assert that each pair exposes two endpoints with its own label. Capture both themes at phone width with a path joined. |
| Trace and correct one path | Give the loose end a distinct shape. Keep saved paths visually distinct from the active stroke when adjacent routes turn. Flow Free’s loose end gives the player a precise cell to look for. | In `RecoverWithPointer`, capture the active tip before cancellation and the board afterward. Assert that the loose end disappears, the previously saved route stays intact, and a new attempt can start. Use `DenseBoardHalfDrawn` to compare adjacent same-color routes. |
| Recognize completion without color | Put a written result near the grid. Distinguish a connected pair from a solved puzzle. Connect Numbers shows pair count and coverage separately, while ConnectLine names the win. | In `CompleteWithKeyboard`, assert that the final connection announces completion once. Include two fixtures with the same uncovered cells and all pairs connected. Assert a win for endpoint-only coverage and an unfinished result for full-board coverage. |

These are proposed checks for the hosted stories. The coverage fixtures follow the two completion rules in the [Numberlink spec](../../../specs/numberlink/complete-and-edit.feature). Existing story entry points are in the [player stories](../src/numberlink-player.stories.tsx).

## Decisions for this board

- Keep digits or words visible at both ends. Assign the cable stitch by pair order so adjacent pairs can share a hue and still have different route markings. The six stitch patterns repeat on large boards, so the endpoint labels carry the full pair identity.
- Keep the hollow loose-end ring during correction. On pickup, the two matching terminals compress briefly and gain an outline. The ring disappears once the route joins its matching terminal. Reduced motion keeps the outline and terminal fill.
- Magnify the puzzle inside its own frame. Numberlink is turn-based and each path stays provisional until release. A second finger discards that provisional path and takes over the board view. Saved paths stay in place. Two fingers can pan; at magnification one pointer can pan from empty space or continue a route from its loose end.
- Retain the two existing completion conditions. The comparison suggests keeping both pair count and coverage available. Changes to the surrounding results and controls belong to the stage.


## Verification record

On 2026-11-25, the hosted DrawPaths recovery cases passed at 390 × 844 and 1440 × 1024. The captures show a shortened path and a joined pair. The separate 20 × 20 phone run exhausted its 30-second budget on the tenth route, so that revision has no final dense-board phone timing. Board-only screenshots, clips and timing notes (PR #577, comment 7159437003)

The Numberlink input harness verifies that placing a second finger abandons the provisional path through both releases. On 2026-11-25, all four hosted cases passed at commit `0364931046`. Both phone and desktop cases drew from a magnified endpoint, returned to fit, retraced and joined a pair, and checked pickup motion with reduced motion enabled and disabled. The same-color case verified endpoint labels and different cable markings. The throttled 390-pixel dense-board case completed ten 20-cell routes. Across 220 input events, p95 time to the next animation frame was 63.8 ms in this single run. [Input contract](../../numberlink-harness-ts/tests/numberlink-pointer-boundary.test.tsx) · [Browser cases](../../../pkgs/ui-root-harness-ts/tests/storybook/numberlink-gestures/integration.checks.ts) · Hosted job (run 45596597851, job 139144193137) · Matched board screenshots and clips (PR #577, comment 7160388566)

## Open questions

- At phone width, can players follow distinct stitches across several adjacent blue routes when they cannot rely on hue?
- Can a first-time touch player discover double-tap to return to fit after inspecting a dense board?

Refresh these findings when a cited publisher changes its board, when Numberlink changes the corresponding interaction, or when new evidence answers either question.
