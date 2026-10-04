# Chessboard conformance map

Product behavior is defined in [the Chessboard context](../../../../specs/chess-board/).
This file maps its implementation evidence; it is not another product definition.

[contract-proofs.ts](../src/harness/contract-proofs.ts) accounts for every key of
the public `ChessBoardProps` type. Adding an option without assigning its evidence
fails type checking. Model bindings observe actual board state and use the full
rendered position, pending input, configuration, focus, speech and audio for their
fingerprints.

| Area | Executable evidence |
| --- | --- |
| Position and parent authority | Authority scenarios, lifecycle model, canonical move callback contracts |
| Selection, input and promotion | Interaction, accessibility and promotion scenarios; promotion model |
| Appearance and continuous sizing | Options scenarios/model; generated geometry and native resize contracts |
| Personal and supplied markings | Annotation scenarios/model; native alignment; pure arrow geometry |
| Waiting-side moves | Premove scenarios/model; canonical ordered callback contracts |
| Motion and interruptions | Motion scenarios/lifecycle model; real abandoned-handle completion; native capture and special-move frames |
| Sound | Sound scenarios/lifecycle model; delayed-playback contract; recorded consumer playback |
| Accessibility | Standing accessibility property; native names/focus/zoom; keyboard scenarios |
| Performance | Existing 50ms budgets; affected-piece and pointer DOM work budgets; native input and live frame cadence |
| Consumer boundaries | Package-owned Chess import and explicit sound-choice gate; puzzle sound integration; silent public benchmark |
| Adversarial quality | [Required source mutations and three consumer sound mutations](MUTATION_RESULTS.md) rejected by intended verifiers |

The production consumers are the puzzle player, puzzle review and developer board
example in `@libs/chess`. Its wrong-move feedback uses the public sound helper.
The reusable benchmark is explicitly silent. Consumer imports are checked by
`@libs/chess`'s `check:board-contract` leaf. No consumer imports an internal renderer.

Local proof commands are `@pkgs/chess-board`'s `test`, `test:spec`, `check:models`
and `test:contract`, alongside `@pkgs/chess-board-core-shared`'s geometry and mechanical
tests. The consumer package runs its own specs and import gate. The release
verdict remains the repository's `bun check`; this map does not substitute for it.
