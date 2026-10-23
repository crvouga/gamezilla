# Numberlink journey specification audit

Scope: [`numberlink-packs.feature`](../specs/journeys/numberlink-packs.feature),
its borrowed language, and existing homonyms made explicit in their own
contexts' glossaries. Initial binding status: undefined, intentionally.
This report does not claim the implementation or release is complete.

## Example map

Context: Journeys. Aggregate coverage: exempt under the specification standard.
Story: an author shares Numberlink with another person and both keep their work.
Commands are the complete authoring, playing, revising and offline journeys.
No new limits or product choices are introduced. Numberlink is borrowed
from Numberlink; private work, publication, packs, attempts and progress come
from Puzzles. Chess's existing puzzle and board vocabulary is unchanged.

Puzzles now publishes the existing author, playtest, publication, edition,
attempt, resumption and pack-progress terms that Journeys needs. The language
gate also requires unrelated meanings to be explicit where those words already
appear: file-save progress in Chess, the feedback writer, an app edition,
automatic index ownership, a note's author, and continuing checkout, shared
notes or an existing game. Their local definitions record existing feature
prose; they do not borrow puzzle behavior or change those contracts.
These additional glossary labels clarify existing words, rather than adding
new business concepts or changing the meaning of any existing scenario.

| Promise | Whole journey | Contrasting evidence |
| --- | --- | --- |
| A playtested pack can be shared | Author visually edits, saves, validates and playtests Numberlink, then arranges, previews and publishes a pack; another person discovers its chosen order | Puzzles owns refusal of invalid, private, foreign and withdrawn contents |
| Personal work crosses app and device boundaries | Play, undo/redo, leave, reopen, resume, complete and continue the pack on another device | Puzzles owns private attempts and conflicting continuations |
| Publication preserves earlier play | Republish changed Numberlink while another person has an unfinished attempt and an earlier pack | Puzzles owns immutable editions and stable pack contents |
| Offline work remains usable and is shared later | Author privately and play available Numberlink without a connection, reopen, then reconnect | Puzzles owns unavailable-content guidance and retained divergent work |

## Review and handoff

- A0–A6: ordinary authoring and play, named actors from the cast, borrowed
  terms and kernel device/connection language. No architectural assertions.
- B1–B3: capability title, one job story, named business rules.
- B4/B5/C: whole journeys are exempt; the chain is the observable behavior.
  This does not close any Puzzles lifecycle model or its coverage map.
- B6–B13: each complete journey starts from its own ordinary app situation;
  the two-step examples describe outcomes, without quoted interface text,
  selectors, fixtures, technical tables or placeholder data.
- B14: the existing catalogs have no author-created Numberlink journey.
  The eight new phrasings name whole flows rather than aliases for individual
  shared-domain actions. Existing chess and multiplayer phrases are retained.
- B15/B16: only the domain tag; two steps per scenario.
- B17/D1: real person-visible outcomes that survive an implementation rewrite.
- P1: this feature and glossary metadata belong in a separate `spec:` commit.
- D2–D5 handoff: bind the same journeys in the full product harness and the
  live product runner, using the production registrations, ordinary identity,
  permission and sync paths. All authoring and playing goes through the real
  shared screens and Numberlink controls. Domain-record seeding is not proof
  of authoring. Observation must include saved content and visible outcomes,
  not merely a control having been pressed.

Verdict: INCOMPLETE. Executable bindings and full release verification remain
open. Four separate initial executions each reached its own journey command
and failed on its undefined step, rather than setup or compilation. The
language gate has no remaining vocabulary error. The strict gate reports the
eight undefined phrasings for both journey runners and the existing thirteen
near-duplicate wording pairs outside this scope. Undefined bindings are the
implementation handoff; the external strict findings prevent a whole-repo
audit pass. No new pair involves a Numberlink phrasing.

The separate `spec:` commit hands off the four scenarios and their eight
phrases to `spec-implement`. No code-level case is promoted to Gherkin and no
existing product behavior changes through the glossary clarifications.
