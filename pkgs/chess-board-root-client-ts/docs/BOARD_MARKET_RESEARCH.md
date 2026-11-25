# How two chess boards show the last move

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

## Board-only opportunities

- Give the last move two quiet square fills and give selection a distinct outline. When a player taps the piece that just moved, the current selection and the previous move should both be readable.
- Leave the center of a capture square clear. Use a center dot for a legal empty square and a perimeter mark for an occupied target. Check both marks on light and dark squares with the board at phone width.
- Mark the checked king on the board with a shape as well as a color. A player following the pieces should be able to find the king even when the move list is offscreen.
- Keep all four promotion pieces inside the board at phone width. Exercise a promotion on each edge file from both orientations, including a tap on the knight for underpromotion.

[knights-gallery]: https://apps.kde.org/knights/
[knights-image]: https://cdn.kde.org/screenshots/knights/knights_main.png
[xboard-gallery]: https://www.gnu.org/software/xboard/#tag-A5
[xboard-image]: https://www.gnu.org/software/xboard/graphics/xboard-4.4.0.png
