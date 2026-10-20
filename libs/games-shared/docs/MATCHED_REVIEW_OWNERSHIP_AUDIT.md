# Matched review ownership audit

Date: 2026-10-20. Status: **INCOMPLETE — full aggregate audit remains open**.
Scope: moving the spoken earlier-position example from Chess into the
canonical matched-game review feature. This is not a whole-framework audit
verdict; outstanding acceptance work remains in
[`FINAL_HARDENING_AUDIT.md`](FINAL_HARDENING_AUDIT.md).

## Example mapping

Context: Games. Aggregate: `matched-game-own-board.qnt`.
When someone listens to their matched game, they want to hear which earlier
position they are reviewing, so they can follow the game without seeing it.
The existing command is `chooseEarlierPosition`; the position stays private
to their device and must be a position the game reached. No new command,
status, event, vocabulary or capability is introduced.

The original Chess example selected `e4` after `e4, e5` and required hearing
the earlier position after that move. The shared example selects the first
move after both people have moved. Each game's independent known move
labels must supply the expected description. The assertion must read the
rendered review description; knowing that the board reached position one
does not prove a listener heard the right move. Chess notation and
interoperable records retain their separate Chess-specific contracts.

| Rule | Example | Counter-example |
| --- | --- | --- |
| Reviewing a position describes its move for a listener | Choosing the first move tells Alice which earlier position she is reviewing | None: hearing describes every earlier position already offered; absence of any earlier position remains the existing refusal example |

## Feature checks

| Verification | Evidence and finding |
| --- | --- |
| A0, A5, A6 | Prose describes Alice choosing a move and hearing its description. No technical vocabulary or new actor. |
| A1–A4 | `matched game`, `move list`, `move`, `earlier position` are Games terms; listening is already borrowed from Runtime, where it is published. Kernel person/device meanings remain unchanged. No term was added. |
| B1–B3 | The existing capability title and job story remain; the new example has its own Rule. |
| B4 | Description is always available for a position that can be reviewed; the Rule states why no separate refusal exists. The existing empty-game example refuses an unavailable earlier position. |
| B5–B9 | One factual Given, one choice, one audible result. No quoted application copy or repeated action in the specification. |
| B10–B13 | Outcome title, no Background, outline or artificial data. |
| B14 | Listening and choosing reuse catalogued phrasings. The new Then names the first move rather than a Chess move. All three retired Chess-only definitions are deleted. The repository-wide nine near-duplicate pairs still require resolution. |
| B15–B17, D1 | Existing domain tag; three steps; a person can hear the outcome under any implementation. No new implementation-detail scenario. |
| D2–D6, P3 | The actual scenario failed on its undefined Then after setup and move selection passed. The binding reads the rendered review description through the harness, comparing the independently supplied first-move label. Both production consumers pass; a deliberately wrong spoken move number fails the Then. No new model binding or I/O. |
| P1–P2 | Specification and source-ownership metadata changes precede the separate binding change. |

## Aggregate coverage delta

| Verification | Obligation | Coverage and remaining work |
| --- | --- | --- |
| C1 | Choose an earlier position | Existing first example of `matched-game-review.feature`, plus the new listener example; `chooseEarlierPosition` remains the existing glossary model name. |
| C2 | Earlier positions were played | Existing first-move and start observations; the new example adds its audible description. No new invariant. |
| C3 | Published event | This aggregate declares no event variant; unchanged. |
| C4 | Current position to an earlier position | The new example exercises the existing legal transition after two moves. Existing no-moves refusal remains. A complete legal/illegal transition map for every command of this aggregate is still open in the parent audit. |
| C5 | Listening describes what is shown | Existing published Runtime borrowing; the new example covers the Games reaction. No relationship added. |
| C6 | No unmodelled choice | The When is the existing `chooseEarlierPosition` command. No model guard changes. |

The product map already owns `matched-game-review.feature` at the matched
game. Remove the old Chess feature reference there; no route or product
state changes.

## Implementation and evidence

New phrasing: Alice hears she is reviewing the earlier position after the
first move. Existing listening setup and first-move selection are reused.
The shared expected move comes from each game's checked fixture labels,
never the product's displayed text. The harness reads the rendered review
description, and all three obsolete Chess-only definitions (listening setup,
move selection and spoken observation) and their unused label table are
deleted. There is no internal case
to demote and no historical regression tag on the removed feature.

The complete shared matched-review and puzzle-attempt-resume features pass
58 checks, with 258 assertions, in 97.83 seconds. The new listener example
passes for Chess and Connect Four. Chess's checked first two actions remain
`e2e4, e7e5`, labelled `e4, e5`, preserving the original input. Changing the
product's spoken move number from 1 to 9 fails the new Then with received
`after 9. e4` versus expected `after 1. e4`. Restoring the product passes
both listener checks again. The deliberate fault is not retained.

Generated catalogs and spec-input manifests were refreshed. Ordinary spec,
product-map and bug-register gates pass together. All six affected type and
lint tasks pass. The ownership-history gate passes. The full repository
gate and the nine strict wording findings remain outstanding; these
targeted passes do not establish a complete aggregate audit.
