# Overnight Mission: Prove Chess Puzzles Complete, Intelligent, and Production-Ready

## Mission

Chess Puzzles already exist. Do not blindly rewrite them. Audit the
product, discover everything missing or underspecified, complete the
executable specification first, prove new obligations red, then
implement until passing the complete specification is sufficient
evidence of a valid, polished Chess Puzzle implementation.

The two largest known gaps are correctness requirements:

1.  The **talking avatar Puzzle Assistant** is weak because its
    behavior/dialogue is underspecified.
2.  Puzzle correctness can depend on one stored solution line, causing
    another valid checkmate or objective-satisfying move to be marked
    wrong.

Treat both as product defects, not optional polish.

Work autonomously for the entire run. **Do not ask questions. Do not
stop at first green. Do not leave TODOs, skipped obligations, incomplete
state spaces, or manual verification.** Continue until repeated
adversarial completeness passes find no meaningful omissions and all
required gates pass.

> **A completely independent Chess Puzzle implementation that passes
> these specifications must be product-equivalent and valid.**

Read `specs/README.md` completely first. Specifications---not current
code, dialogue trees, puzzle data, or UI---are product truth. Use
ubiquitous language for concepts; Gherkin for observable rules; Quint
for lifecycle/history/concurrency; DMN for permissions/limits; Alloy for
legal structural worlds; OpenSLO for quantitative promises; journeys for
critical cross-context behavior; and conformance to close the world.

------------------------------------------------------------------------

# Phase 0 --- Audit Everything That Exists

Inspect every Puzzle spec/model/decision/structure/objective/journey,
step/binding, harness action/read, implementation, puzzle source/data,
chess-rule integration, rating/limits/history/review/offline behavior,
and every part of the talking avatar assistant.

For the assistant inspect every dialogue tree and trigger; every
observation it can make; correct/wrong/illegal move reactions;
check/checkmate/stalemate; tactical mistakes;
hints/retries/completion/failure; interruptions and rapid moves; puzzle
transitions; speech/visual/transcript state; audio unavailable/muted
behavior; accessibility; and whether analysis derives from the actual
position or thin canned branches.

Create an internal matrix for every behavior: **specified? implemented?
independently proven? gap?** Existing behavior is not automatically
correct.

------------------------------------------------------------------------

# Phase 1 --- Complete Modern Puzzle Behavior

Audit puzzle discovery/feed; starting position; orientation/side to
move; legal/illegal candidate moves; correct/incorrect moves; multi-move
lines; opponent replies; promotions/underpromotion; castling/en-passant
where legal; check/mate/stalemate; retry/hint/solution if supported;
completion; next puzzle; rating; limits; leaving/returning;
offline/reconnect; multiple devices; history/review; watching if
supported; accessibility; privacy; and terminal boundaries.

Ask what a modern chess player reasonably expects after every action.
There must never be an ambiguous dead end. Reuse canonical Chess
legality/rules truth; do not build a second puzzle-only chess rules
implementation.

------------------------------------------------------------------------

# Critical Correctness Requirement --- Accept Chess Truth, Not One Stored Line

The defect where a puzzle stores one solution move but another move is
also checkmate **must become impossible by specification**.

A player's move must not be declared wrong merely because it differs
from a canonical/stored solution line when the move satisfies the
puzzle's defined chess objective.

Specify and prove:

-   **Any legal move that checkmates immediately is accepted as success
    whenever checkmate satisfies the current puzzle objective.**
-   If a position contains multiple legal checkmates, **every valid
    checkmate is accepted**.
-   Stored solution data never overrides actual chess truth.
-   A move cannot be marked incorrect solely because it differs from the
    preferred/canonical line.
-   Equivalent objective-satisfying moves have explicit semantics.
-   If a puzzle requires something narrower than a winning/checkmating
    continuation, that objective is explicit product truth rather than
    inferred from one stored line.
-   Contradictory puzzle data cannot cause a legal objective-satisfying
    move to be punished.
-   Completion, rating, allowance, history, assistant reaction, and
    review all agree that an accepted alternate checkmate succeeded.
-   Promotions/underpromotions and unusual legal positions obey the same
    rule.
-   Repeated/offline/concurrent completion through alternate valid moves
    still produces exactly one logical completion effect.

## Declarative Gherkin requirements

Add representative business rules proving:

-   a position with two different mating moves accepts either;
-   a stored preferred mate does not make another checkmate wrong;
-   a non-mating move remains wrong when the objective requires mate;
-   an illegal apparent mate is rejected by canonical Chess legality;
-   an alternate accepted mate produces the same
    completion/rating/history/assistant outcome as the canonical mate.

Do not enumerate positions in giant Gherkin tables.

## Exhaustive property

Use independent property/model-based verification to establish:

> For every legal candidate move in a tested position, if applying that
> move satisfies the puzzle's specified terminal objective under
> canonical Chess rules, the Puzzle evaluator cannot classify it as
> incorrect.

Generate/adversarially search positions with multiple mates and
equivalent valid continuations. Add a mutation restoring "only stored
move is correct"; the suite must fail. The implementation under test
must not simply serve as its own oracle.

------------------------------------------------------------------------

# Critical Product Area --- Talking Avatar Puzzle Assistant

The talking avatar is part of the Chess Puzzle product contract. It is
**not decorative UI** and must not remain an ad-hoc canned dialogue
tree.

> **The assistant reacts to what actually happened on the board and
> explains the most useful relevant observation it can justify from the
> position.**

It must never invent chess facts, contradict the board, or comment on a
stale puzzle/position. Exact prose is generally not product truth;
**semantic observations and dialogue behavior are**.

## Observation taxonomy

Build and specify a reliable taxonomy. At minimum investigate:

-   correct move;
-   incorrect move;
-   illegal move;
-   check;
-   unresolved check / king still in check;
-   checkmate;
-   missed checkmate;
-   hanging/undefended or inadequately defended piece;
-   knight/rook/bishop/queen/pawn left hanging;
-   fork / being forked;
-   pin;
-   skewer;
-   discovered attack;
-   double attack;
-   overloaded defender;
-   trapped piece;
-   removal of defender;
-   back-rank weakness/mate;
-   discovered check;
-   double check;
-   promotion tactic;
-   mating threat;
-   material loss/gain;
-   capture of a hanging piece;
-   failure to answer a threat;
-   tactical opportunity relevant to the puzzle;
-   correct intermediate continuation;
-   solved/failed state;
-   retry/hint/solution behavior if supported.

Do not add every chess motif merely because it exists. Support
observations that can be reliably derived and usefully communicated.

## Wrong-move diagnosis

Generic "wrong move" is insufficient when a reliable, useful observation
exists.

Examples of semantics: - move failed to resolve check → observe that the
king remains in check; - move leaves the knight hanging → point out the
hanging knight; - move walks into a fork → identify the fork; - player
misses immediate mate → draw attention to the mating opportunity
according to hint policy.

These are semantic examples, not exact required strings.

Define a deterministic or explicitly constrained **observation priority
policy** when several observations are true. Never emit contradictory
commentary because several classifiers fired. Put this policy in
declarative decision/spec/property machinery, not only implementation
code.

## Grounded tactical analysis

Assistant observations derive from canonical position truth. Create
independently testable analyzers/classifiers for supported observations
where appropriate.

For each supported observation prove positive examples, close negative
examples, ambiguous boundaries, absence of false claims, and consistency
after legal transitions. Prefer silence or generic truthful guidance
over a specific claim that cannot be established confidently.

## Dialogue policy

Specify assistant behavior as policy over puzzle facts, not a brittle
UI-state tree. Inputs may include attempt status, latest move result,
grounded board observations, puzzle progress, help already given,
repeated observations, and terminal state.

Specify: - eligible observation; - priority; - when it speaks; - when
silent; - repetition/non-repetition; - escalating help if supported; -
interruption; - state change during speech; - transition to next puzzle.

If generated/template variation exists, specify semantic constraints all
utterances must satisfy. Variety must never alter chess truth.

## Synchronization

Aggressively test move while speaking; rapid moves; wrong move→immediate
retry; correct move→automatic opponent reply; solve while commentary
active; leave while speaking; next puzzle while speaking; reconnect;
audio unavailable; mute/unmute; repeated render/retry; stale analysis
arriving after board state changed.

> **Stale analysis/dialogue must never be presented as commentary on the
> new board or puzzle.**

## Accessibility

Product-significant assistant information cannot depend exclusively on
hearing or seeing the avatar. Audit/specify text/semantic equivalent
where required, screen-reader access, mute, reduced motion,
keyboard/focus behavior, and that speech/animation never blocks puzzle
operation. Automate these obligations.

------------------------------------------------------------------------

# Phase 2 --- Ubiquitous Language

Audit Chess vocabulary first. Add only genuine product concepts with
canonical definitions/forms/avoids/model names. Do not pollute the
glossary with implementation classifiers. Reuse established sourced
chess terminology.

------------------------------------------------------------------------

# Phase 3 --- Gherkin Completeness

Gherkin must become the readable product contract. Audit/add Rules for
puzzle acquisition; starting position; correct/incorrect/illegal moves;
multi-move progression; opponent response; alternate valid solutions;
multiple checkmates; completion; retry/help; next puzzle; rating;
limits; leave/return; offline/reconnect; multi-device; history/review;
assistant reactions; accessibility; privacy; every meaningful refusal.

For assistant behavior include representative scenarios proving: -
useful response to correct move; - grounded diagnosis of incorrect
move; - unresolved check identified; - truly hanging piece identified; -
real fork identified; - absent tactic is not claimed; - correct priority
when several observations apply; - stale commentary is never
shown/spoken; - next puzzle resets context; - alternate checkmate
produces success commentary, never wrong-move commentary; -
muted/non-audio users retain required information.

Every Rule proves both sides. Follow all repository Gherkin constraints:
exactly one When, Given=fact, Then=observable, no UI/implementation
mechanics, brief declarative scenarios, canonical vocabulary, no giant
tactical matrices.

Pure tactical classifier exhaustiveness belongs in property/model
checks.

------------------------------------------------------------------------

# Phase 4 --- Quint: Exhaustive Puzzle + Assistant Lifecycle

Improve the existing Puzzle model instead of unnecessary parallel
models.

Model product-significant current puzzle/attempt, progress, terminal
state, exactly-once rating/allowance/history effects,
offline/device-visible state, and assistant semantic state where
observable.

Model candidate moves, correct/incorrect outcomes, opponent
continuation, completion, retry/help, leave/return, next puzzle,
connection loss/restoration, and assistant
observation/speaking/interruption/state replacement where observable.

Prove invariants: - solved cannot become failed; - terminal attempts
cannot reactivate; - completion/rating/allowance/history effects happen
at most once; - moves after terminal state cannot alter result; -
accepted alternate mates have identical success lifecycle guarantees; -
assistant never describes a different logical puzzle/position than its
observation; - stale assistant observations cannot overwrite current
commentary; - assistant commentary cannot contradict terminal outcome; -
repeated events cannot duplicate result/assistant effects; - reconnect
cannot resurrect stale attempt/dialogue; - multiple devices cannot
double-complete/double-rate; - history agrees with final outcome.

Construct:
`attempt status × command → transition | idempotent/no-op | refusal | unavailable`

and where useful:
`puzzle event × grounded observation facts → allowed assistant semantic response`

Explore deep histories: correct→incorrect→retry→solve;
correct→leave→return→solve; alternate mate→complete;
offline→solve→reconnect; device A alternate-mates while B acts; wrong
move→analysis→rapid retry→old analysis arrives; solve→next puzzle while
old speech remains active.

Increase model-check depth until these histories are reachable.

------------------------------------------------------------------------

# Phase 5 --- DMN, Alloy, and Pure Chess Properties

Use DMN for Puzzle permissions, membership gates, daily limits, and
actual decisions, with generated boundaries and real enforcement checks.

Use Alloy for timeless structural truths: attempts relate to valid
puzzle/person; final outcomes are non-contradictory; history/effects
reference valid attempts; and other discovered invariants.

Use property-based verification for pure/exhaustive chess predicates,
especially legal moves, check/checkmate, alternate objective-satisfying
moves, multiple checkmates, supported tactical observation predicates,
close positive/negative tactical cases, and observation priority if
pure.

------------------------------------------------------------------------

# Phase 6 --- Closed-World Completeness and Polish

Build coverage maps for every command, observable invariant, event,
transition, refusal, permission, structural invariant, assistant
semantic category, supported tactical observation, nondeterministic
outcome, environment, and externally observable operation.

Repeatedly ask: - Can a legal checkmate ever be marked wrong? - Can a
valid solution be rejected because absent from stored data? - Can
assistant commentary contradict canonical chess truth? - Can it describe
a stale position? - Can it miss an obvious supported observation and
fall back to useless dialogue? - Can multiple observations produce
contradictory responses? - Can rapid interaction break
synchronization? - Can mute/accessibility remove required information? -
Can retry/reconnect/multiple devices double-count
completion/rating/limits? - What modern Puzzle behavior is still
absent? - What undesirable Quint trace or invalid Alloy world remains?

No unexplained `MISSING`.

------------------------------------------------------------------------

# Phase 7 --- Prove Red, Then Implement

Run every new/changed obligation against the current product and observe
meaningful red before implementation.

Then implement the smallest coherent changes satisfying the completed
contract.

**Do not fix alternate mates by adding known alternatives to puzzle
data. Fix the abstraction:** correctness evaluates the specified chess
objective so future multi-solution positions cannot reproduce the
defect.

**Do not fix the assistant by adding a handful of canned strings. Fix
the abstraction:** derive grounded semantic observations from
board/puzzle state, define dialogue policy, and render/speak those
semantics reliably.

------------------------------------------------------------------------

# Phase 8 --- Adversarial Mutation Loop

A first green implementation is the midpoint.

Seed defects and require the intended verification layer to fail: -
restore exact stored-line-only validation; - reject a second valid
mate; - mark checkmate wrong; - double-apply rating; - double-consume
allowance; - resurrect completed attempt; - assistant says king remains
in check when safe; - assistant claims hanging knight when defended; -
assistant misses a supported fork; - assistant calls alternate mate
wrong; - stale assistant analysis appears after retry/next puzzle; - old
puzzle speech survives puzzle transition; - contradictory observations
both surface; - audio/motion blocks puzzle operation; - permission/limit
bypass.

Continue audits, increase Quint bounds, inspect Alloy instances, test
tactical predicates, search implementation for unspec'd behavior, and
search specs for unbound obligations until stable.

------------------------------------------------------------------------

# Phase 9 --- Final Verification

Run all applicable checks: - `bun run spec:check --strict-duplicates`; -
Chess/Puzzle domain specs; - Quint trace conformance; - Apalache/model
checking with sufficient depth; - DMN
completeness/consistency/enforcement; - Alloy checks/snapshot
conformance; - property-based chess/assistant analyzers; - Gherkin
acceptance; - accessibility conformance; - relevant journeys; -
conformance manifest; - `bun run spec:ownership`; -
`bun run spec:catalog`; - full `bun check-pr`; - every affected
release/conformance gate.

No skipped, unknown, stale, unbound, unsupported, or manually verified
required obligation is acceptable.

# Definition of Done

Stop only when: - passing specs is sufficient evidence of a valid Puzzle
implementation; - every valid objective-satisfying checkmate is
accepted, including alternate mates; - stored solution lines cannot
override chess truth; - Gherkin completely describes meaningful
Puzzle/assistant behavior; - Quint proves lifecycle, retries,
offline/multi-device, exactly-once effects, and assistant
synchronization; - assistant observations are grounded in canonical
chess truth; - supported tactical observations have positive and
negative proof; - wrong moves receive the most useful reliably justified
observation according to explicit policy; - assistant never contradicts
the board or comments on stale state; - dialogue is semantically rich
without depending on brittle canned branches; - assistant remains usable
without audio/animation where required; - DMN/Alloy/property checks
cover their respective domains; - repeated adversarial audits find no
meaningful omissions; - mutation tests catch the known alternate-mate
defect and assistant truth/synchronization defects; - all conformance
gates pass; - zero manual testing is required.

## Final instruction

**Keep working overnight until this definition of done is satisfied. Do
not ask for clarification. Discover missing behavior, specify it first,
prove the current implementation red where incomplete, implement against
the specification, adversarially audit it, and continue until Chess
Puzzles---including the talking avatar assistant---are complete,
polished, and provably correct.**
