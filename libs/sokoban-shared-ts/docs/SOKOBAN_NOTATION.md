# Sokoban position notation

A position fits on one ASCII line. It carries its own dimensions, terrain and pieces. The first puzzle in **Receiving dock** is `SK1:6#/##3-#/#-.--#/#--$-#/#-@--#/6#`. Expand the counts and break at each slash to draw it.

```text
######
##   #
# .  #
#  $ #
# @  #
######
```

Read rows from top to bottom and squares from left to right. All rows must have the same width. Each dimension is 1–20. Prefix a glyph with a decimal count from 1 to 20 to repeat it. Omit leading zeroes. The canonical writer compresses runs of three or more and writes shorter runs literally.

| Glyph | Square |
| --- | --- |
| `#` | Wall |
| `-` | Floor |
| `~` | Outside the warehouse |
| `.` | Goal |
| `@` or `+` | Worker on floor or goal |
| `$` or `*` | Crate on floor or goal |

A classic puzzle has one worker and as many goals as crates, with at least one crate. A catalog entry's separate `solution` records one move per character using `l`, `r`, `u` and `d`. For the diagram above, `rurul` puts the crate on its goal. Importing a board requires only its position string.

## Grammar

```text
position  = "SK1:" row ("/" row)* (";" key "=" value)*
row       = ([count] glyph)+
glyph     = "#" | "-" | "~" | "." | "@" | "+" | "$" | "*"
count     = decimal integer 1..20
key       = [a-z][a-z0-9.-]*
value     = [A-Za-z0-9@.,:+_~-]+
```

Each extension name occurs once. Extension order carries no meaning. The canonical writer sorts fields by their ASCII key. Readers preserve unknown fields and their values for interchange. Treat every field as required for play. A classic-only engine refuses the position and names the extensions it needs. An unrecognized version must also be refused. Coordinates use a column letter and row number starting at A1 in the top left.

For example, this extended position locates a second player, a bridge, linked teleporter endpoints and a key. These are example layer conventions for future rules.

```text
SK1:8#/#@-$-.-#/#6-#/8#;bridge=D3;item=key@E3;player2=B3;teleport=C3,F3
```

In `@libs/sokoban-shared-ts/sokoban-notation`, `readSokobanNotation(text)` returns the board and its extension fields, `writeSokobanNotation(position)` emits the canonical single line, and `drawSokobanNotation(position)` returns a monospace diagram followed by any layers. Previously saved JSON definitions still open through `decodeSokobanBoard`.
