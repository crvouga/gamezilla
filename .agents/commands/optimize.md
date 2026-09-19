---
description: Make UI, shell chrome, overlays, and client runtime fast and jank-free across the full device and runtime matrix (low-end Android to high-end iPhone, web and Capacitor)
---

# /optimize — performant across the full device/runtime matrix

## When to run

Trigger whenever UI, shell chrome, overlays, or client runtime feel slow,
animated, or indirect. Goal: **no jank anywhere we ship** — fast, instant,
and responsive from the cheapest supported phone up to the best, in both
the browser and the Capacitor-wrapped app.

## Target matrix (read first)

We ship on **two independent axes**, not one platform with a bar:

- **Device tier:** low-end Android Go class (~2 GB RAM, Slow 3G–4G) up to
  high-end recent iPhone.
- **Runtime:** mobile web browser, and Capacitor-wrapped native app —
  on both Android and iOS.

That's four shipped combinations, and they compound rather than
substitute for each other:

- **The true floor is low-end Android *through Capacitor*** — weak
  CPU/GPU/network **and** native bridge overhead stacked together. This is
  worse than low-end Android web alone and should be the actual reference
  target for "does this feel instant," not an edge case.
- **High-end iOS Capacitor** is a different failure mode, not a lesser
  one: hardware isn't the constraint, but WebKit compositing, JavaScriptCore
  JIT/GC behavior, and bridge-call cost per-call (not per-CPU-cycle) are.
- **iOS web (Safari)** shares WebKit's engine quirks with iOS Capacitor
  minus the bridge overhead — don't assume "fixed for Capacitor" already
  covers it, or vice versa.
- **Android web** is the CPU/network-bound baseline everything else builds
  on.

Concretely, on the Capacitor runtime:
- **Native bridge overhead.** Plugin calls (haptics, storage, status bar,
  etc.) cross a JS↔native bridge that plain mobile web never pays for.
  Frequent small calls on hot paths (scroll, drag, per-frame handlers) can
  jank a Capacitor build even when the identical DOM/JS is smooth in a
  browser — and it's worst when it lands on the weak-CPU end of the device
  axis.
- **Different cold-start shape.** The shell is typically bundled locally,
  so startup looks like parse + hydrate rather than network + parse.
  Network/LCP budgets stop being the binding constraint there; startup
  jank shows up in bridge init and plugin registration instead.

A fix must not silently trade one cell of this matrix for another — e.g.
don't add a per-tap plugin call to work around a Blink-only layout quirk,
and don't add compositor-heavy CSS to smooth over what was actually a
bridge-call problem.

Byte / LCP / critical-path budgets live in
[`docs/LOW_END_ANDROID_PERF.md`](docs/LOW_END_ANDROID_PERF.md) and
[`apps/client/perf-budget.json`](apps/client/perf-budget.json). This
command is about **runtime jank and interaction cost** across the matrix,
not bundle size — leave those docs and the budget file alone (see
constraints below).

## Non-negotiable constraints

1. **Never soft-deprecate.** Delete old APIs and update every call site in
   the same change.
2. **Never fake the budgets.** Don't satisfy critical-path/Lighthouse gates
   with eager `import()`, disabled checks, or a loosened
   `perf-budget.json`. If a gate looks wrong, stop and report it using the
   failure template.

## The load-bearing test

Apply this test to every effect, transition, measurement, or bridge call
before touching it:

> Is this signaling real async state the user is actively waiting on (a
> mutation in flight, an opponent's move landing), or is it a genuine
> native capability (haptic feedback on a confirmed action)?

- **Yes → keep it.** Mutation spinners, core game-move transforms, and
  intentional native-feature calls are load-bearing.
- **No → it's decorative. Remove it.** Celebration scales, typing-dot
  loops, overlay enter/exit motion, ambient pulses, count-ups, sliding
  indicators, and any bridge call that fires just for polish are
  decorative even if they look nice.

**Whatever survives this test still has to respect
`prefers-reduced-motion`.** Removing decorative motion doesn't remove the
need to check that what's left honors the user's OS-level preference —
verify it's actually wired up, don't assume it is.

## Design principles

- **Static over dynamic.** Fixed props/placement over measuring, flipping,
  or animating position. `placement="bottom-end"` on a menu — not a JS
  viewport nudge.
- **Instant over animated.** Mount at final opacity/position; drop
  decorative enter/exit.
- **Direct over indirect.** Fewer wrappers, fewer reactive effects on
  open/mount, no always-on `will-change`, no multi-layer shadow / shimmer /
  compositor busywork for cosmetics.
- **Cheap on both engines, not just one.** Prefer CSS/DOM approaches that
  are inexpensive on both Blink and WebKit over ones tuned to a single
  engine's fast path. When in doubt, treat WebKit as the pickier engine.
- **Least main-thread work, not just least visible motion.** A kept
  transition is still expensive if it fires on every re-render of a
  component that shouldn't have re-rendered in the first place — re-render
  discipline is as much a jank source as CSS.
- **Evidence over taste.** If removing an effect doesn't hurt understanding
  or async signaling, remove it — don't keep something just because it's
  polished.

## Cross-cutting risks beyond motion

Check these separately — they won't show up as CSS/animation hits, and
several bite hardest exactly at the worst-case cell (low-end Android ×
Capacitor):

| Risk | Hits hardest at | Why |
|---|---|---|
| `backdrop-filter`, heavy `filter:`, large blurred layers | High-end iOS Capacitor / iOS web | Expensive to composite in WebKit even on fast hardware |
| `position: sticky`/`fixed` inside scroll containers or transformed ancestors | Both engines, differently | Known Blink/WebKit divergence in repaint behavior |
| Frequent native plugin calls in scroll/drag/per-frame handlers | Any Capacitor build, worst on low-end Android | Bridge cost is per-call, not per-CPU-cycle, and stacks on a weak CPU |
| Unmemoized re-renders, wide context fan-out, prop-drilled callbacks recreated each render | Low-end Android, any runtime | No CPU headroom to absorb wasted render work |
| Heavy synchronous compute on the interaction path (e.g. move validation/engine analysis run inline) | Low-end Android × Capacitor | Blocks the main thread directly; a Web Worker candidate |
| Heavy main-thread JS on tap/scroll (large sync loops, unthrottled listeners) | Low-end Android | Weak CPU has no headroom to hide it |
| Layout thrash (`getBoundingClientRect`, `ResizeObserver`, auto-flip on open) | Both | Forces synchronous layout regardless of engine |
| Retained listeners/subscriptions without cleanup, unbounded image memory across mount/unmount | ~2 GB-class devices | Backgrounded/evicted under memory pressure, not just slow |
| Large eagerly-loaded assets/JS on cold start | Low-end Android (network) / Capacitor (parse/hydrate) | Different bottleneck, same symptom: slow first paint |

## Out of scope

- The budgets/gates themselves (flag issues there, don't edit them).
- Non-visual business logic.
- Fully native code paths outside the WebView (Swift/Kotlin native
  screens, App Store/Play Store concerns) — this command covers the web
  content running in both the browser and the Capacitor shell, not the
  native shell itself.
- Third-party scripts/tags — flag as a jank source if noticed, don't
  attempt to fix or remove them here.
- Anything outside the given scope (or the default hot spots below, if no
  scope was given) — note similar jank elsewhere as a remaining risk in the
  summary rather than opportunistically fixing it.

## Workflow

### 1. Scope

Use the text after `/optimize`, open files, or the recent change set. If an
explicit scope is given, stay confined to it. Default hot spots when scope
is broad:

- Shell chrome / tabs / miniplayer — `apps/client`, `libs/spaces`
- Tooltips, floating menus, modals, sheets, banners — `@pkgs/ui`
- Chess board, move validation/engine calls, celebration motion —
  `@pkgs/chess-board`, `@libs/chess`
- Any native-bridge / Capacitor plugin call sites touched by the above

### 2. Audit

Search the scoped code for these patterns and run every hit through the
load-bearing test:

| Category | Search for |
|---|---|
| CSS animation | `transition:`, `@keyframes`, `animate-`, `duration-`, infinite loops |
| Motion library | `from 'motion'`, `<Motion`, enter/exit opacity+translate on overlays |
| Layout measurement | `getBoundingClientRect`, `ResizeObserver`, auto-flip / edge-shift on open |
| JS-driven visuals | `setInterval`, count-up logic, sliding pill/indicator position state |
| Always-on cost | `will-change`, multi-layer `box-shadow`, shimmer/skeleton loaders |
| Cross-engine cost | `backdrop-filter`, heavy `filter:`, `position: sticky` in scroll containers |
| Bridge cost | native plugin calls (e.g. `@capacitor/*`) inside scroll/drag/frame handlers |
| Re-render cost | components re-rendering on unrelated state, wide context providers, callbacks/objects recreated inline on every render (profile with the React DevTools profiler — this category isn't reliably greppable) |
| Sync compute | move validation / engine / analysis calls made inline on the interaction path instead of via a worker |
| Memory | `addEventListener`/subscriptions without matching cleanup in effect teardown; large images retained in state/refs past need |

Then cross-reference the risk table above for anything the shared patterns
wouldn't catch.

### 3. Apply fixes

Rewrite toward static placement props, instant show/hide, and lean mount
paths. Memoize components/values on the interaction path where re-renders
were wasted work. Move genuinely heavy synchronous compute off the main
thread (Web Worker) where feasible rather than just trimming it. Clean up
listeners/subscriptions on unmount. Prefer fixes that are cheap on both
Blink and WebKit and don't add bridge calls to fix a CSS problem or vice
versa; if a fix must trade one cell of the matrix for another, say so
explicitly in the summary. Update tests that asserted enter timing or
shift math. Leave Spinner, other genuine async signals, and intentional
native-feature calls untouched — but confirm they still honor
`prefers-reduced-motion`.

### 4. Verify

Run typecheck and focused tests for **every touched package**:

```sh
bun run --filter <package> tc
bun run --filter <package> test
```

Repeat for each `@pkgs/*`, `@libs/*`, or `@apps/*` package actually
touched — not just one.

**Known limitation:** typecheck/tests confirm nothing broke, not that
jank actually improved — capture a before/after Performance-panel trace
for main-thread-heavy fixes when feasible. DevTools CPU throttling also
understates real Android Go thermal throttling after sustained use, and
simulated throttling can't reproduce Capacitor bridge-call cost at all —
prefer a real low-end Android device and a real Capacitor/WKWebView build
(via Safari's remote inspector) over simulation when either is available.
State plainly which of these you actually did versus only reasoned about.

### 5. Summarize

End with:

- What became instant / static / direct (1–3 bullets)
- Packages touched
- Checks run, and which matrix cell(s) — device tier × runtime — they
  actually covered (real device/build vs. simulated)
- Any remaining jank, memory, or re-render risk you didn't fix, tagged by
  which matrix cell(s) it affects, including anything flagged as
  out-of-scope in step 1 (third-party scripts, etc.)

## Failure / stop template

```
Stopped before finishing optimize.
Scope: <files or feature>
Blocked by: <human decision | incorrect gate | missing context>
Evidence: <what you found>
Next: <what a human should decide>
```