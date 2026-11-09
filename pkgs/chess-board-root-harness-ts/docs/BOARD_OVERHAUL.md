# Chess board usability review

This run covers the reusable board and its multiplayer, custom-game, puzzle-play
and puzzle-review consumers. Product behavior remains defined in
[Chessboard](../../../../specs/chess-board/) and [Chess](../../../../specs/chess/).
The [agent workflow](../../../ui-root-harness-ts/README.md#agent-workflow) owns
automated UI evidence; [verification](VERIFICATION.md) describes existing checks.

## Review contract

Two fresh independent Codex reviewers, `reviewer-a` and `reviewer-b`, inspect the
same immutable revision and evidence each round. They receive no other reviewer's
opinion. The fixed [overhaul rubric](../../../../.agents/skills/ui-ux-overhaul/council-review-prompt.md)
applies, with design judged for functional clarity and a separate performance
dimension: measured input-to-paint response, long tasks, rendering work, repeatable
mobile constraints and explicit measurement limits. Ten means best-in-class
shipped quality in each dimension; missing evidence means incomplete.

Completion requires both reviewers to independently give design, UX/playability
and performance/responsiveness 10/10 on the same candidate, task preservation,
passing scoped checks and `bun verify`. A human merges the PR.

## Surface and evidence map

| Player task | Production surface | Existing evidence owner |
| --- | --- | --- |
| Select, drag or use keys to make a legal move | `ChessBoard`, hit grid, pointer and keyboard controllers | Chessboard example, contract tests and formal models |
| Read orientation, check, last move and legal targets | Board frame, squares and guidance | `product-chessboard` and `screens-games-chess-board` stories |
| Promote, cancel and recover focus | Board promotion and input lifecycle | Promotion model, browser accessibility and promotion-choice story |
| Play or watch a timed game | Chess game presentation | Full-screen game stories and chess multiplayer harness |
| Solve a puzzle and understand feedback | Puzzle play view and board | Chess puzzle stories and puzzle harness |
| Review an attempt without changing it | Puzzle review view and board | Review stories and puzzle review harness |
| Recover from interrupted input or a changed position | Board lifecycle and consumer status | Lifecycle model and interrupted-embedding browser contracts |

Captures use deterministic positions, phone/tablet/desktop viewports and both
themes. Each revision gets an immutable local evidence directory, an index and
content hashes. PR round comments retain before/after SHAs, matching screenshots
and videos, independent reviews, task completion, accessibility, performance
measurements and unresolved limits. Existing checked-in baselines are historical
references, not a claim that this candidate passed.

## Initial discovery

The board already separates piece animation from hit targets, has keyboard and
promotion models, and exposes a compiled browser example. Full-screen game stories
cover play, watching, check, endings and underpromotion. Existing browser timing
contracts cover a 50ms budget but do not by themselves establish low-end-device
performance. Fresh videos, repeatable throttled measurements and the complete
consumer state matrix must be collected before a complete review is possible.

The initial checkout had no dependencies or feedback reports. `bun install` and
`bun feedback --list` completed successfully. These are setup results only.
