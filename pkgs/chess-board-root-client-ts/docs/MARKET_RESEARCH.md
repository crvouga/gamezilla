# Chess board market research

In KDE's KNights, a player can trace Black's last knight move from b8 to c6 by the borders on those two squares. In GNU XBoard, the move field above the board names Black's bishop move to e6. The bishop's square shares the same yellow fill as the other light squares.

## Gameplay screenshots

![KNights game window with borders on b8 and c6, a black knight on c6, and Nc6 in the move history.][knights-image]

KDE publishes this KNights screenshot as “Main Window - Human vs. Chess Engine.” Alexander Semke is playing White against gnuchess. The last entry in the engine console reads `b8c6`. The move history beside the board records the same move as `Nc6`. Accessed 2026-11-25. [KDE Applications gallery][knights-gallery] · [Full-size PNG][knights-image]

![XBoard game window with a black bishop beside its queen and 27... Be6 above the board.][xboard-image]

The GNU Project publishes this screenshot of a standard chess game in XBoard 4.4.0. The move field reads `27... Be6 (0:03.706)`. The black bishop on e6 sits between a white pawn on d6 and the black queen on f6. Accessed 2026-11-25. [GNU XBoard screenshot gallery][xboard-gallery] · [Full-size PNG][xboard-image]

## What the boards show

| Board cue | KNights | XBoard 4.4.0 |
| --- | --- | --- |
| Piece recognition | The knight's horse-head profile on c6 differs from the queen's pointed crown on d4. Both pieces fit inside their square borders. | The cross inside the bishop on e6 distinguishes it from the crowned queen beside it. The square colors remain visible around both pieces. |
| Last move | Dark inset borders mark the empty origin and occupied destination. The center of c6 stays clear for the knight. | The move field identifies the piece and destination. The board shows its usual grid around the bishop. |
| Coordinates | Letters and numbers appear on all four edges, so a reader can match c6 in the move history to the board. | The grid runs to the window edges without coordinate labels. A reader must count files and ranks to locate e6 from the notation. |

Both screenshots capture a completed move in a desktop game. Neither shows an active selection, a legal destination or capture marker, a king in check, or a promotion choice.

## Chess board decisions and verification

Reviewed 2026-11-25 for the board shared by matches and puzzles.

| Player task | Decision | Evidence |
| --- | --- | --- |
| Reconstruct the last move without opening the move list | Keep both square centers clear, as in the KNights screenshot. An open corner marks departure and a solid corner marks arrival. The arrival mark can share a square with selection brackets. | The Round 2 move journey ends with the pawn on e4. Compare its two corner marks with the earlier fitted board. [Round 2 hosted run][round-two] |
| Choose a piece and find a legal destination on a phone | Give each piece a distinct silhouette. Bracket the selected square, put a dot on an empty destination and a ring around a capture target. | Hosted phone and desktop captures show selection and completed moves. The phone recording exercises touch, mouse drag and keyboard activation. [Board-only screenshots and recordings][round-one-media] |
| Find the checked king and choose a promotion piece | Stripe the checked square along its edge. Pair each promotion silhouette with its name inside the board. | Hosted checks exercised check, promotion cancellation and underpromotion. [Round 1 verification][round-one] |
| Inspect a live position and return to play | A second finger cancels the pending move. Pinching magnifies around the midpoint. A tap while magnified reads the square and its occupant. Fit board restores move input. | The mounted-board test exercises a held empty square, bounded pan, a transformed rook hit and a subsequent legal move. Hosted phone and desktop journeys cover cancellation and motion preferences. [Mounted-board test](../tests/board-inspection.test.tsx) · [Round 2 hosted run][round-two] |

## Outstanding questions

- Can players identify the direction of the last move at phone width when the arriving piece is also selected? The captures establish what is drawn. Recognition time still needs player evidence.
- Can players discover how to inspect and return to fit during a timed turn? The desktop competitor screenshots provide no evidence about touch gestures.
- How do the legal capture ring and the striped check marker read when the target is on a dark square? Collect matched phone captures when these cues change.

[round-one-media]: https://github.com/crvouga/gamezilla/pull/581#issuecomment-7158863682
[round-one]: https://github.com/crvouga/gamezilla/actions/runs/45588696455
[round-two]: https://github.com/crvouga/gamezilla/actions/runs/45594114695

[knights-gallery]: https://apps.kde.org/knights/
[knights-image]: https://cdn.kde.org/screenshots/knights/knights_main.png
[xboard-gallery]: https://www.gnu.org/software/xboard/#tag-A5
[xboard-image]: https://www.gnu.org/software/xboard/graphics/xboard-4.4.0.png
