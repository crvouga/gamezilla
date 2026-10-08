# Mobile and native app design

Read this for phone, tablet, Capacitor/native wrapper, on-screen keyboard and
adaptive layout work. Visual decisions still belong to the
[design system](../../../../pkgs/ui-root-client/README.md); platform conventions
guide interaction, not a second palette or component library.

## App structure and navigation

Respect the existing shell's destination hierarchy. Use primary navigation for
stable peer destinations, push navigation for deeper content, and a modal or
sheet for a bounded task. A segmented control changes the current view; it is
not a substitute for app navigation.

Preserve familiar back behavior and the selected destination. Dismissing an
overlay returns to its opener; backing out of details returns to the list with
its context intact. Use the existing router and overlay abstractions. Account
for Android back and browser history through those abstractions rather than
installing competing handlers in a screen. Define focus restoration and any
specified handling of unsaved edits with the affected flow.

Keep the main task reachable with one hand. Use the established footer or action
bar when an action belongs near the bottom. Keep secondary actions out of the
primary action's visual competition. Avoid putting the same action in both the
header and footer without a task-specific reason.

## Touch and assistive input

Apple recommends controls at least **44 × 44 points**; Android recommends touch
targets at least **48 × 48 dp**. These are platform logical units, not physical
pixels. For new shared web touch controls, aim for a **48 × 48 CSS px** hit area
where compatible with the design system; this is a project design recommendation,
not a conversion between those units. Existing primitives own target geometry;
repair a shortfall there, not by ad-hoc wrappers in each screen.

An icon can be smaller than its hit area. Expanded hit areas must not overlap
neighbors. Ensure each control's accessible name conveys the action, and that
switches, selections and progress expose their state. Provide an explicit
alternative to swipe-only, drag-only or long-press-only actions. Do not hijack
system edge gestures. Design for touch, keyboard and assistive technology
together.

## Viewport, keyboard and scrolling

- Let `ScreenBase` and the shell own insets and scroll geometry. Prevent double
  safe-area padding; check top controls, bottom actions and the final list row.
- Honor available height as the browser chrome or keyboard changes. Use existing
  viewport infrastructure instead of feature-local window measurements.
- Keep the focused field, its error and the completion action reachable when
  the keyboard is open. A pinned footer must not cover focused content.
- Choose appropriate input semantics, autocomplete and input mode. Keep visible
  labels; a placeholder alone is not a label. Preserve valid input after failure.
- Prefer one deliberate vertical scroll owner per region. Horizontal movement
  should be purposeful, such as a game board interaction, not text overflow.
- Give overlays an accessible title, focus containment, dismissal and a reachable
  action area; allow long content to scroll inside the established primitive.

## Adaptation and content resilience

Start with the compact task composition, then adapt to available space through
the existing layout mode. On wider surfaces, consider a bounded content column
or a list/detail composition when it helps the task. Stretching a phone form
across a tablet is not an adaptive design. A two-pane layout should preserve the
same navigation and selection semantics when it becomes one pane.

Use representative constraints in automated coverage, selected for the change:

| Constraint | What should hold |
| --- | --- |
| Narrow phone and short landscape viewport | Essential content and actions remain reachable |
| Keyboard open | Focus and actions are unobscured; the screen can scroll |
| Tablet / wide window | Reading width is controlled; unused space is intentional |
| Enlarged text / web zoom | Content reflows; labels and essential values remain available |
| Long translations and right-to-left content | Logical alignment and action order remain meaningful |
| Dark and light schemes | Each state uses readable semantic tokens |
| Reduced motion | Feedback is still understandable without transitions |
| Long lists and busy states | Scrolling stays responsive; updates do not displace the task |

Do not clamp essential action labels or shrink text to make a layout fit.
Allow growth and wrapping; use truncation only for secondary content whose full
value has an accessible retrieval path. Prefer logical start/end alignment for
bidirectional content, with domain-specific exceptions such as board notation.

## Performance is part of the feel

Keep geometry stable during loading, progress and image arrival. Reserve media
space where appropriate, and use the existing virtualized list for genuinely
large collections. Avoid adding work to every scroll or pointer event; reuse
the established animation and interaction primitives. Display immediate press
feedback while asynchronous work uses the prescribed mutation states. Never
fake success or invent a timer to conceal a slow operation.

## Example decisions

- **Account settings:** grouped rows with inline values and familiar trailing
  controls; an established mutation modal for destructive actions. A collection
  of individually decorated cards would weaken grouping.
- **Editing a profile:** persistent labels and recoverable validation, with the
  screen's save/cancel footer and keyboard clearance. Keep the edit context
  visible after the mutation outcome according to the repo's UX policy.
- **Game detail:** prioritize the playable surface and clock/status hierarchy;
  secondary details can follow the task content. Extra dashboard chrome must
  earn its space.

## Primary guidance

Consult the relevant official guidance when a task requires deeper platform
detail; do not load every manual for a routine screen change. Links checked
2026-10-07:

- [Apple UI design guidance](https://developer.apple.com/design/tips/): touch
  controls, readable content and alignment.
- [Apple accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility):
  assistive interaction and text adaptation.
- [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views):
  touch target geometry and semantics.
- [Android adaptive layouts](https://developer.android.com/design/ui/mobile/guides/layout-and-content/adapt-layout):
  adapting to the available window.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): web accessibility requirements.
- [Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum):
  focus around sticky headers, footers and overlays.
