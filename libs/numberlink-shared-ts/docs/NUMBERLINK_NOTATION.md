# Numberlink board notation

A board fits on one ASCII line that carries its own size, endpoints and rules, with no catalog lookup. It reads like a chess FEN. **First threads 9** ships as `NL1:A3A/1BC1D/1E1C1/1B1E1/D4`. Expand each count into that many empty cells and break at each slash to draw it:

```text
A...A
.BC.D
.E.C.
.B.E.
D....
```

Rows run from top to bottom and cells from left to right. A letter is an endpoint; the two cells carrying the same letter are one pair. A decimal count from 1 to 20 is that many empty cells. Pairs are numbered in letter order on the board, so `A` is pair 1.

## Grammar

```text
notation = "NL1:" row 1*("/" row) *(";" record)
row      = 1*(run / endpoint)
run      = %x31-39 *DIGIT              ; 1 to 20 empty cells, no leading zero
endpoint = %x41-5A / %x61-7A           ; A-Z, then a-z: pairs 1 to 52
record   = key "=" value
key      = %x61-7A *31(%x61-7A / DIGIT / "." / "-")
value    = 1*256(ALPHA / DIGIT / "@" / "." / "," / ":" / "+" / "_" / "~" / "-")
```

Bounds are strict: 2 to 20 rows, each 2 to 20 cells and as wide as the first; every letter exactly twice; at most 16 records and 2048 characters. Letters must first appear in alphabet order while reading the rows, and two counts never sit side by side, so every board has exactly one spelling. A version other than `NL1` is refused.

## Records

Records follow the rows, each key once. Their order carries no meaning; the writer puts keys in ASCII order. Cells are named as on the board: a column letter A–T and a row number from 1 at the top, so A1 is the top-left cell.

| Record | Meaning | Playable |
| --- | --- | --- |
| `cover=pairs` | Only the pairs need joining; cells may stay empty. Covering every cell is the default, so `cover=all` is never written. | Yes |
| `bridge=C3,D5` | Cells where two paths may cross. | No |
| `item=key@B2,gem@D4` | Collectibles a path picks up. | No |
| `players=2` | Two to four people share the board. | No |
| `teleport=C3,F3` | Linked cells, two by two; a path entering one continues from the other. | No |
| any other `key=value` | A rule from a later version. | No |

Every record is read into typed data and written back unchanged, so tools can carry a board they cannot play. The rules refuse such a board before play and name the mechanic it needs. These are the same conventions as the [Sokoban notation](../../sokoban-shared-ts/docs/SOKOBAN_NOTATION.md). The ASCII board marks bridges `+`, teleporters `@` and items `*`:

```text
NL1:A1B/3/B1A;bridge=B2;item=key@A2,gem@C2;players=2;teleport=B1,B3

A@B
*+*
B@A
bridge=B2
item=key@A2,gem@C2
players=2
teleport=B1,B3
```

## Catalog entries

`src/numberlink-catalog.json` holds the shipped packs in order. Each puzzle has a two-digit `id` that is stable within its pack, its `board` in this notation and its `solution`: the same rows with every cell carrying the letter of the path through it, or `.` where `cover=pairs` leaves it empty. First threads 9 is solved by `AAAAA/BBCCD/BEECD/BBEED/DDDDD`. The solution is expanded into the puzzle's witness only when a test asks for it, and a published edition never carries it.

Every full-coverage catalog board has exactly one solution; an exhaustive search checked that when the catalog was generated. The tests replay each shipped solution and refuse repeats under rotation, reflection or relettering; they do not re-prove uniqueness.

## Code

In `@libs/numberlink-shared-ts/numberlink-notation`, `parseNumberlinkNotation(text)` reads untrusted text without throwing, `formatNumberlinkNotation(notation)` writes the one canonical line and `numberlinkAsciiBoard(notation)` draws the board and its records. `definitionOfNotation` and `notationOfDefinition` in `numberlink-notation-definition` convert to and from the JSON definitions authors save. Saved JSON definitions keep opening through `decodeNumberlinkDefinition`, which reads either form.
