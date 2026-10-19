# Chessboard verification

Behavior is defined in [the Chessboard specs](../../../../specs/chess-board/).
[CONFORMANCE.md](CONFORMANCE.md) maps every public option and verification area.
This record describes automated evidence and its limits.

| Evidence | Result |
| --- | --- |
| Independent canonical move and promotion matrices | 185 passing cases; full FEN, rendered pieces, last move and callback metadata |
| Compositor adapter and custom identifier contracts | 14 passing cases |
| Complete Chessboard behavior context | 1,022 passing checks; 1,135 assertions |
| Chessboard formal models | Seven checked; lifecycle's complete finite graph contains 418 states and verifies eventual completion |
| Package code contracts after legacy removal | 270 passing cases; 6,091 assertions |
| Native compiled browser contracts | 27 passing cases; 63,746 assertions |
| Chessboard core contracts and geometry properties | 99 passing cases |
| Actual puzzle, review and preference sound scenarios and model replay | 43 passing checks, including exact playback counts and replay fingerprints |
| Chess code contracts | 258 passing cases |
| Chess formal models | Three checked; recovery model's complete finite graph contains 1,664 states |
| Required adversarial source mutations | All fifteen rejected; sources restored |
| Additional consumer sound-policy mutations | All three rejected; sources restored |
| Additional capture-ring and coordinate-placement mutations | Both rejected; sources restored |
| Complete repository release gate | Required `bun verify`; the commit report records its verdict |

Native checks run the compiled public example in Bun's browser backend, using
WebKit on macOS and Chrome on Linux. Their cache is scoped by the repository's
platform input. Fresh reference boards have new model and piece nodes, so an
interrupted animation is compared with an independently mounted final position.
Lossless rasters complement full piece identity and real DOM geometry.
Capture rings and all sixteen coordinate labels are checked against actual
viewer-edge square bounds at fractional sizes, both orientations and zoom.
A capture interrupted by resizing, turning and a newer position must settle
to the same raster as a fresh mount of that position.

Generated geometry checks cover fractional widths, both orientations, resizes
and scale changes throughout the declared range. Native checks measure actual
square adjacency, piece centers and hit mapping. Motion checks observe real
compositor paths, capture remnants and genuine abandoned completion callbacks.
Performance checks retain the existing 50ms input, work-slice and frame budgets,
plus unaffected-piece and drag-write counts; reduced motion preserves outcomes.

Consumer checks record actual audio-port play calls, including puzzle feedback
outside the board. A fixed initial tape boundary excludes fixture preparation;
every subsequent modeled configuration or move retains its real playback.
Exact-count scenarios detect duplicate cues that a model's set of cue classes
cannot count. Settings scenarios navigate to the real preference switch and
return to the activity. They exercise a resumed consumer; the reusable board's
own models cover configuration changes while mounted.

[PARITY.md](PARITY.md) accounts for all 102 instantiated legacy cases before
their removal. [SPEC_AUDIT.md](SPEC_AUDIT.md) and
[CONSUMER_AUDIT.md](CONSUMER_AUDIT.md) record independent audits and their scope.

[MUTATION_RESULTS.md](MUTATION_RESULTS.md) records each injected defect and the
intended assertion that rejected it. No manual browser inspection contributes
to these results. The repository's `bun verify` remains the release decision.
