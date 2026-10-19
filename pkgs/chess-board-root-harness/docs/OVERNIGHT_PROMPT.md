# Overnight Mission: Make the Chessboard Perfect, Reusable, Smooth, and Provably Correct

## Mission

Focus **only on the reusable Chessboard product surface and its
integration contract**.

The Chessboard already exists. Audit it, discover every correctness,
interaction, responsiveness, animation, sound, embedding, accessibility,
and performance gap, complete the executable specification first, prove
missing obligations red, then implement until passing the complete
specification is sufficient evidence of a valid Chessboard
implementation.

> **The Chessboard must feel flawless: correct, extremely responsive,
> visually stable, exceptionally smooth during moves and captures,
> reusable by parent applications, correct at every supported size,
> accessible, and performant under adversarial interaction.**

Work autonomously. **Do not ask questions. Do not stop at first green.
Do not leave TODOs, skipped obligations, incomplete states, manual
visual verification, or "looks smooth" as evidence.**

Read `specs/README.md` completely first. The implementation is not
product truth. A different board implementation passing the same
complete specification must be acceptable.

Stay narrowly focused on board rendering, squares/pieces,
movement/captures, animation, interaction/highlighting, orientation,
resizing, parent-controlled configuration, sound, accessibility, app
integration, rendering/input performance, and state updates directly
affecting the board. Reuse canonical Chess legality; do not create a
second rules engine.

## Specification strategy

Use: - ubiquitous language for board concepts; - Gherkin for observable
interaction/integration rules; - Quint for temporal
interaction/animation state, interruptions, rapid updates,
orientation/configuration changes; - property tests for geometry,
coordinates, sizing, transforms, interpolation and pure exhaustive
behavior; - automated accessibility checks; - quantitative performance
gates/objectives; - conformance to prevent silent untested obligations.

No manual QA counts as release evidence.

------------------------------------------------------------------------

# Phase 0 --- Audit Existing Board

Inspect every board spec, implementation, public
interface/configuration, and every consumer: games, Puzzles,
review/analysis if present. Inspect move input, drag/click/touch,
promotion integration, orientation, highlights, last move/check
indication if owned, animation, capture animation, piece assets,
geometry, resize/responsive behavior, sound and parent sound
configuration, reduced motion, accessibility, rendering/update
architecture, performance tests/profiles, harness, tests, and known
bugs.

For every behavior classify:

`specified | implemented | automatically proven | gap`

Inventory the **embedding contract**: what parent
supplies/emits/controls, what board owns, what it must never own,
defaults, runtime changes, and changes during interaction/animation. Do
not preserve accidental API behavior merely because it exists.

------------------------------------------------------------------------

# Phase 1 --- Interaction Correctness

Audit selection/deselection, selecting another piece, click/tap
destination, drag, legal/illegal drop, drop outside board, drag
cancellation, pointer/touch interruption, rapid repeated input, input
during/immediately after animation, parent state change during input,
promotion handoff, read-only/spectator/review mode, disabled input,
orientation/resize during interaction, and parent replacing position
during interaction.

No interaction may leave ghost/duplicate/missing pieces, stale
selection/highlights, pieces between squares, incorrect pointer capture,
invisible interactive pieces, or contradictory board state.

Mouse/touch/pointer/keyboard/assistive input where supported must have
equivalent product semantics, not necessarily identical gestures.

------------------------------------------------------------------------

# Phase 2 --- Perfect Geometry at Every Supported Size

Treat layout as mathematical correctness.

Prove: - board remains square where contracted; - exactly 8×8 squares; -
no logical gaps/overlap/cumulative rounding drift; - pieces remain
centered/aligned; - hit targets exactly agree with rendered squares; -
pointer→square and square→coordinate transforms are correct; -
White/Black transforms are exact inverses; - highlights align; - drag
coordinates remain correct under scaling; - resize does not corrupt
selection; - resize during animation remains coherent; - minimum
supported size works; - large desktop works; - narrow/tall/wide parent
containers work; - embedding never assumes full viewport; -
zoom/device-scale differences do not change logical mapping; -
coordinate labels, if present, remain correct.

Use property-based tests across large generated ranges of dimensions,
coordinates, orientations and resize sequences. Do not call a few
breakpoints complete. Explicitly define supported size limits and
deliberate degradation outside them.

The parent container owns available space according to the documented
embedding contract.

------------------------------------------------------------------------

# Phase 3 --- Exceptional Move and Capture Animation

Movement/capture animation is first-class behavior.

Audit normal slides, short/long/diagonal moves, knight moves, castling,
promotion, captures, en passant, parent position updates, opponent
moves, rapid consecutive moves, animation interruption,
resize/orientation change during animation, hidden→shown board, reduced
motion, and replacement by newer authoritative position.

## Animation invariants

At every observable moment/final state: - one logical piece has at most
one visual representation unless an explicitly specified transition
requires otherwise; - captured pieces cannot accidentally reappear; -
moving piece begins at correct source and ends exactly at destination; -
final visual state equals latest authoritative position; - stale
animation cannot overwrite newer state; - completed animation cannot
resurrect captured/moved pieces; - no piece remains between squares; -
visual/input state cannot permanently diverge; - animations cannot
reorder logical moves; - interruption deterministically resolves to the
current valid position.

## Captures

Treat captures specially. Audit attacker movement, captured-piece
disappearance, timing relationship, same-square transition, capture
while prior animation finishes, consecutive captures, en passant,
promotion capture, and immediate newer position update.

A capture should feel like one coherent event, not unrelated state
changes.

## Continuity defects that must be impossible

No teleporting, snapping from unrelated rerenders, flickering, duplicate
pieces, one-frame empty-destination artifacts, captured-piece flashback,
layout shift, animation restart from equivalent parent rerender, or
stale completion after newer state.

Use automated geometry/time-series/visual checks where appropriate.
Manual inspection does not satisfy this obligation.

------------------------------------------------------------------------

# Phase 4 --- Performance Is Correctness

The board must be **extremely performant**, especially while animating.

Inspect repository performance conventions and supported environments
first. Establish meaningful automated budgets from product/environment
evidence rather than arbitrary numbers.

Measure/gate where applicable: - input→visible-response latency; -
move/capture frame pacing; - long tasks/blocking; - work per animation
frame; - unnecessary rerenders; - unaffected-piece churn; -
allocation/GC pressure over repeated moves; - resize/orientation cost; -
repeated position-update cost; - drag/touch responsiveness; - multiple
boards if supported; - sustained move sequences; - low-end supported
browser/device profile where deterministic infrastructure permits.

During ordinary moves unrelated app state must not cause expensive board
work; unaffected pieces should not churn needlessly; animation must
avoid layout thrashing; pointer movement must not trigger app-wide work;
semantically unchanged parent rerenders must not restart animation;
interaction remains responsive while animation runs.

Profile before/after optimization. Never trade correctness/accessibility
for benchmark numbers.

Automate evidence for missed/late frames, frame-time spikes, long tasks,
discontinuity, unexpected layout work, and input latency. If noisy
browser timing prevents a stable ordinary-CI threshold, create
deterministic lower-level work/animation tests plus isolated performance
gates rather than abandoning automation.

------------------------------------------------------------------------

# Phase 5 --- Parent / App Integration Contract

The Chessboard is reusable. **Parent applications are authoritative for
parent-level preferences/configuration.**

Audit position, sound, interactivity, orientation,
animation/reduced-motion policy, highlights, selected square if
controlled, last move, check state if supplied, legal destinations/input
policy if supplied, and other genuine public options.

For every option specify runtime behavior while idle, selected,
dragging, animating, and between rapid moves.

## Hard sound requirement

> **If the parent says sound is off, the Chessboard produces no
> Chessboard sound.**

Prove sound off before mount; runtime off; off during animation; later
on; move/capture/check/mate sounds disabled; rapid moves; parent
rerender; multiple boards; unmount; and stale asynchronous sound after
disable.

The board must not maintain a preference that can contradict parent
authority. No animation may implicitly play audio outside this contract.

When sound is enabled, prove exactly one appropriate sound per specified
logical event, no duplicate sound on rerender, no stale-animation sound,
no rejected/aborted-interaction sound unless explicitly specified,
capture sound matches capture, unmount prevents future sound, and board
instances do not trigger each other.

## Consumer conformance

Test representative consuming apps through the public board contract.
Search consumers for workarounds indicating missing reusable
capabilities. Improve the reusable contract where justified rather than
copying hacks into apps. Consumers must not depend on undocumented board
internals.

------------------------------------------------------------------------

# Phase 6 --- Accessibility and Reduced Motion

Automatically verify board semantic identity, square/piece meaning where
applicable, keyboard operation if supported, focus, selected state,
legal destination communication where appropriate, move completion
feedback, orientation semantics, screen-reader behavior, high zoom,
reduced motion, sound-disabled use, and that information is not
communicated only by animation/sound.

Reduced motion must produce correct final states without depending on
animation completion.

------------------------------------------------------------------------

# Phase 7 --- Gherkin Contract

Create/update Gherkin only for meaningful observable rules. Audit Rules
for selection/move, illegal destination, drag cancellation, capture,
rapid input, disabled/read-only board, orientation, resize-visible
behavior, parent position replacement, parent sound-off/runtime sound
changes, parent disabling interaction, reduced-motion semantics,
stale-update protection, accessibility interaction, and representative
embedding behavior.

Every Rule proves both sides. Follow repository standards: exactly one
When, Given=fact, Then=observable, no
DOM/components/selectors/props/framework terms, brief scenarios,
canonical vocabulary, no giant viewport tables.

Geometry/performance exhaustiveness belongs in property/gate machinery.

------------------------------------------------------------------------

# Phase 8 --- Quint State/Animation Model

Where temporal board state is observable, strengthen/create the
appropriate Quint model.

Model authoritative position, displayed transition state where
product-significant, selection/interaction status, move/capture
transition, orientation, interactivity, and parent configuration needed
to prove authority.

Model select, move, capture, parent position change, orientation change,
interaction disable, animation completion/interruption, and rapid newer
state arriving.

Prove: - stable displayed state eventually equals latest authoritative
position; - stale transitions cannot overwrite newer positions; - no
piece duplication/loss after quiescence; - captured pieces remain
captured; - disabled interaction cannot produce moves; - animation
resolves to a valid board snapshot; - orientation/resize never alters
logical position; - parent configuration remains authoritative; -
repeated equivalent parent state creates no duplicate logical effects.

Explore move→new move before completion; capture→resize→new position;
drag→parent disables interaction; animation→orientation flip→new move;
sound-enabled event→parent disables sound→later event; rapid
authoritative position sequences.

Do not encode pixels in Quint.

------------------------------------------------------------------------

# Phase 9 --- Property-Based Geometry

Generate board dimensions, squares, orientations, pointer positions,
source/destination pairs and resize sequences.

Prove: - coordinate transforms are bijective in intended domains; -
points map to correct squares under deliberate edge rules; - every
square lies within board bounds; - squares tile board logically; -
orientation transform is reversible; - piece centers equal square
centers; - drag/drop remains correct after supported resize; -
highlights share interaction geometry; - final animated coordinates
equal static destination coordinates.

Hit tiny supported boards, odd/fractional dimensions, large boards,
corners, edges and scale/zoom representations where testable.

------------------------------------------------------------------------

# Phase 10 --- Automated Visual Regression

Where appearance is product-significant, add a small deterministic
matrix: representative desktop, mobile/narrow, minimum supported board,
White/Black orientation, selected/highlighted state, deterministic
capture-transition points, promotion/check indicators if owned, and
reduced-motion final state.

Screenshots complement semantic/property tests; they do not replace
them. Human approval is not release evidence.

------------------------------------------------------------------------

# Phase 11 --- Closed-World Completeness Audit

Account for every public interaction, parent-controlled option, runtime
option transition, observable state, animation type, interruption path,
input modality, orientation, supported size range, sound/no-sound,
accessibility mode, reduced motion, consumer integration, and
quantitative performance obligation.

Repeatedly ask: - Can any piece duplicate, disappear, teleport, flicker,
or end wrong? - Can a captured piece flash back? - Can stale animation
overwrite newer state? - Can rerender restart animation? - Can parent
sound-off still produce audio? - Can stale sound fire after disable? -
Can resize change logical square mapping? - Can hit testing disagree
with rendering? - Can orientation alter logical state? - Can drag state
survive incorrectly? - Can rapid moves visually reorder? - Can parent
update during animation corrupt board? - Can poor frame performance make
interaction unusable? - Does board assume a particular app/container? -
Does any consumer need a workaround because the reusable contract is
incomplete? - Does reduced motion break final-state correctness? - Is
anything required verified only by human eyes?

No unexplained `MISSING`.

------------------------------------------------------------------------

# Phase 12 --- Prove Red, Then Implement

Every new/changed obligation must meaningfully fail against the current
incomplete implementation before its implementation change.
Compile/setup/unrelated failures do not count.

Then implement the smallest coherent changes satisfying the completed
board contract.

Do not patch individual consumer apps when the missing capability
belongs to the reusable Chessboard.

Do not patch animation defects with timing hacks that violate
interruption or authoritative-state semantics. Fix the underlying
transition architecture.

Do not fix performance by disabling required behavior.

------------------------------------------------------------------------

# Phase 13 --- Adversarial Mutation and Stress Loop

First green is the midpoint.

Seed defects and require the intended verifier to fail: - allow sound
despite parent disabled; - duplicate move sound on rerender; - stale
delayed sound after disable; - restart animation on equivalent parent
rerender; - stale animation overwrites newer position; - captured piece
flashes/reappears; - duplicate visual piece; - wrong pointer→square
mapping after resize; - Black orientation mapping error; - drag survives
parent disabling interaction; - resize during animation ends at old
coordinates; - reduced motion depends on animation callback; - introduce
unnecessary full-board rerender; - introduce frame-blocking work; -
consumer bypasses public contract.

Stress rapid move sequences, capture sequences, resizes, orientation
changes, configuration toggles and parent rerenders. Continue
profiling/auditing until stable.

------------------------------------------------------------------------

# Phase 14 --- Final Verification

Run all applicable checks: - `bun run spec:verify --strict-duplicates`; -
board/Chess domain specs; - Quint trace/model conformance and sufficient
model-check depth; - property-based geometry/coordinate tests; -
automated visual regressions; - accessibility conformance; - performance
gates; - representative consumer integration specs; - conformance
manifest; - `bun run spec:ownership`; - `bun run spec:catalog`; - full
`bun verify`; - every affected release/conformance gate.

No skipped, unknown, stale, unbound, unsupported, or manually verified
required obligation is acceptable.

# Definition of Done

Stop only when: - passing board specs is sufficient evidence of a valid
implementation; - every supported interaction is deterministic and
bug-free; - geometry/hit testing are proven across the supported
continuous size range, not a few breakpoints; - White/Black orientation
is exact; - move and capture animation is visually coherent under
interruption and rapid updates; - stale transitions can never win; -
pieces never ghost, duplicate, flicker, flash back, or finish
incorrectly; - capture animation is polished and coherent; - parent
applications fully control documented preferences; - parent sound-off
guarantees zero board sound; - runtime configuration changes are safe; -
representative apps integrate only through the reusable contract; -
reduced motion and accessibility are correct; - performance budgets are
automated and passing; - move/capture animations remain responsive and
smooth under realistic stress; - no required behavior depends on manual
visual inspection; - repeated adversarial audits and mutation tests stop
finding meaningful gaps; - all conformance/repository gates pass.

## Final Instruction

**Keep working overnight until this definition of done is satisfied. Do
not ask for clarification. Discover missing Chessboard behavior, specify
it first, prove current gaps red, implement against the specification,
profile and stress it, adversarially audit it, and continue until the
reusable Chessboard is exceptionally smooth, performant, responsive,
perfectly integrated, and provably correct.**
