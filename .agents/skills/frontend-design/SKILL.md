---
name: frontend-design
description: Design and implement polished, consistent product interfaces using this repository's design system. Use for new screens, UI redesigns, frontend components, interaction design and visual consistency reviews, especially mobile and native app experiences. Does not apply to backend-only work or purely mechanical frontend edits.
---

# Frontend design

Deliver an interface that feels deliberately designed: clear hierarchy, confident
spacing, familiar interactions, readable content and complete states. Optimize
for the person's task and consistency across the app. A screenshot of the happy
path is not the deliverable; the working screen is.

## Read the authority before designing

- [AGENTS.md](../../../AGENTS.md): implementation, interaction and verification rules.
- [Design system](../../../pkgs/ui-root-client/README.md): the app's visual identity.
  It owns palette, typography, surfaces, radius and motion. Do not invent a
  competing theme or reinterpret its rules in a feature.
- [Repository briefing](../../../README.md#repository): composition and package ownership.
- Relevant `specs/` feature and glossary: the person's goals, actions and language.
- Closest existing screen and the actual props and examples of candidate
  components in `pkgs/ui-root-client/src/`. Search before creating a primitive.

For phone, tablet, native wrapper, keyboard or adaptive layout work, also read
[MOBILE_DESIGN.md](references/MOBILE_DESIGN.md).

Use the requested product, references and scope. When a supplied reference
conflicts with the established visual system, carry over its information
hierarchy and interaction intent using the app's components. A brand redesign
requires an explicit request and belongs in the shared design system.

## Make the design decision concrete

Before substantial implementation, state a compact design brief in the progress
update: who uses this screen, the task, the primary action, the closest existing
pattern and the intended compact/wide composition. Resolve routine details
from the repo; ask only about a missing decision that materially changes the
outcome. For a small change, keep the brief to a sentence.

Separate existing product behavior from presentation choices. Route new behavior
through the spec workflow linked in AGENTS.md; do not invent account restrictions,
plans, workflows or data to make a layout look finished.

Sketch the information order in text before building:

1. Location and context: the person knows where they are.
2. Task content: the content they came for occupies the visual center of gravity.
3. Next action: one obvious primary action per task region.
4. Supporting facts: visible when useful, quieter than the content.
5. Secondary and destructive actions: discoverable with appropriate weight.

Choose deliberate emphasis. A routine settings screen should be quiet and compact;
a game should give space to the board; a profile can have an identity hero.
Do not turn every screen into a dashboard or marketing page.

## Compose a consistent screen

| Need | Starting point |
| --- | --- |
| Header, navigation, insets, scrolling, pinned footer | `ScreenBase` |
| Destination list | `MainMenuScreen` |
| Related settings or actionable rows | `MenuSection`, `MenuList`, `MenuRow` |
| Screen save/cancel | `FormActionsFooter` in the screen footer |
| Confirmed or destructive mutation | `MutationModal` |
| Lightweight mutation | `Button` with `useMutationButton` |
| Empty, error, success or explanatory content | Existing state components and `Notice` |
| Choice within one view | Existing picker or `SegmentedControl`, as appropriate |

This is a search map, not a promise about an API: read the exports, types and
examples before using a component. Follow AGENTS.md for mutation feedback and
navigation after completion.

- Establish a common content edge. Align titles, row labels, fields and footers;
  avoid small unexplained offsets between sections.
- Make related things closer than unrelated things. Reuse the spacing rhythm of
  the closest good screen; use layout utilities for arrangement.
- Use type roles for hierarchy. Strong hierarchy comes from placement, grouping
  and emphasis, not a new font size for every label.
- Reserve visual emphasis for the current selection and the next meaningful
  action according to the design system. Keep destructive action distinct.
- Give dense content a stable reading order. Present important numbers with
  their units; keep metadata subordinate and aligned.
- Treat icons as supporting cues. Choose from the established icon surface,
  keep comparable icons at the same optical size, and label unfamiliar actions.
- Use real domain language and believable content lengths. No lorem ipsum,
  invented metrics, emoji icons or decorative content to fill space.
- Add imagery only when it communicates something the task needs. Use existing
  assets first; new assets must fit the same art direction and ownership rules.
- When a pattern is missing, extend the shared component with a coherent API and
  an example. Do not build a feature-specific copy of a shared primitive.

Avoid decorative gradients, nested card piles, oversized headers and competing
accent colors. Follow the design-system authority for the exact visual rules.
Polish is the alignment, hierarchy, content and interaction working together.

## Design the states alongside the content

For the affected flow, identify the applicable states before implementation:

| State | Design question |
| --- | --- |
| Initial loading | Is there immediate structure and a stable place for content? |
| Ready / populated | Can the person understand the content and next action? |
| Empty / first use | Is the absence explained with a useful next step? |
| Filter has no matches | Can the person revise or clear the filter? |
| Pending write | Is the initiating control visibly busy without duplicate submission? |
| Success | Is completion explicit and consistent with the mutation UX? |
| Error | Are the cause, preserved input and recovery action understandable? |
| Permission denial | Does the existing permission surface explain the next step? |
| Offline / reconnecting | Does the UI accurately express supported sync behavior? |
| Long or extreme content | Do wrapping, counts and lists preserve the hierarchy? |

Use the existing data and status contracts. Do not substitute a perpetual spinner
for a missing error state or imply durability the application does not provide.
Match loading placeholders to the final geometry when supported. Preserve useful
content during refresh and inputs after failure according to the spec.

## Implement without losing the design

Follow the Solid reactivity, DI, permissions, local-query and mutation rules in
AGENTS.md. Keep the screen focused on composition; shared behavior belongs in
the appropriate component or hook. Translate visible strings through the repo's
localization system, including accessible names, errors and recovery actions.

Provide semantic controls, meaningful accessible names, visible focus and a
logical reading order. Never make hover, color or a gesture the only way to
understand or operate a control. Preserve reduced-motion behavior.

## Verify the actual outcome automatically

Use the automated verification policy in
[README.md](../../../README.md#correctness-machinery). No manual click-through
or screenshot inspection serves as proof. Run the affected package checks and
the required gate; report the exact scope that passed.

Choose checks that reach the changed behavior: state transitions, accessible
names, focus ownership, layout bounds, input preservation, safe-area clearance
or recorded-state rendering. A source-string assertion that a class exists does
not establish that the screen is usable. Use the existing UI example app,
product harness and recorded visual-quality pipeline where applicable. Keep
visual thresholds meaningful; never loosen them to accept a regression.

Review the implementation against these acceptance questions before finishing:

- Is the primary task immediately clear, with deliberate emphasis?
- Does the screen look like its neighbors and reuse the same interaction pattern?
- Are applicable loading, empty, failure and completion states complete?
- Do compact, wide, long-content and accessibility cases remain operable?
- Can every changed behavior be reached by an automated check?

Fix deficiencies within the authorized scope. Conclude with what changed, the
checks run and any unresolved limitation. Do not claim a numerical design score
or universal device coverage without measured evidence.
