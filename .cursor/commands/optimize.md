# /optimize — performant across the full device/runtime spectrum

## When to run

Trigger whenever UI, shell chrome, overlays, or client runtime feel slow,
animated, or indirect. Goal: **no jank anywhere in the target spectrum** —
fast, instant, and responsive from the cheapest supported phone up to the
best.

## Target spectrum (read first)

This command optimizes for **two different failure modes at two different
ends of the spectrum**, not one platform with a "good enough" bar:

- **Floor — low-end Android mobile web.** Android Go / ~2 GB class, Slow
  3G–4G common in emerging markets. Failure mode: raw CPU/GPU/network
  starvation. Fixing this is mostly about *doing less work* — fewer
  reflows, less compositor churn, less JS on the main thread.
- **Ceiling — high-end iOS via Capacitor.** Modern iPhone hardware, so raw
  CPU/GPU is not the constraint. Failure mode is different in kind, not
  just less severe:
  - **WebKit, not Blink.** Compositing, `backdrop-filter`,
    `position: sticky`/`fixed`, and shadow/filter rendering behave
    differently in WKWebView than in Chrome. A fix tuned for Blink's
    compositor isn't automatically correct for WebKit.
  - **JavaScriptCore, not V8.** Different JIT warmup and GC behavior. Code
    shaped around V8-specific costs may target the wrong thing here.
  - **Native bridge overhead.** Capacitor plugin calls (haptics, storage,
    status bar, etc.) cross a JS↔native bridge that plain mobile web never
    pays for. Frequent small bridge calls on hot paths (scroll, drag,
    per-frame handlers) can jank a Capacitor build even when the identical
    DOM/JS is smooth in Chrome.
  - **Different cold-start shape.** Capacitor typically bundles the shell
    locally, so startup looks like parse + hydrate rather than network +
    parse. Network/LCP budgets stop being the binding constraint there;
    startup jank shows up in bridge init and plugin registration instead.

**Being snappy on the floor does not imply being snappy on the ceiling,
and vice versa.** A fix must not silently trade one for the other — e.g.
don't add a per-tap Capacitor plugin call to work around a Blink-only
layout quirk, and don't add compositor-heavy CSS to smooth over something
that was actually a WebKit bridge-call problem.

Byte / LCP / critical-path budgets live in
[`docs/low-end-android-perf.md`](docs/low-end-android-perf.md) and
[`apps/client/perf-budget.json`](apps/client/perf-budget.json). This
command is about **runtime jank and interaction cost** on both ends of the
spectrum, not bundle size — leave those docs and the budget file alone
(see constraints below).

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
> native capability (haptic feedback on a real action)?

- **Yes → keep it.** Mutation spinners, core game-move transforms, and
  intentional native-feature calls (e.g. haptics on a confirmed move) are
  load-bearing.
- **No → it's decorative. Remove it.** Celebration scales, typing-dot
  loops, overlay enter/exit motion, ambient pulses, count-ups, sliding
  indicators, and any bridge call that fires just for polish are
  decorative even if they look nice.

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
- **Evidence over taste.** If removing an effect doesn't hurt understanding
  or async signaling, remove it — don't keep something just because it's
  polished.

## Platform-specific risks to check

Beyond the shared audit patterns below, check these separately because
they only bite on one end of the spectrum:

| Risk | Hits mainly | Why |
|---|---|---|
| `backdrop-filter`, heavy `filter:`, large blurred layers | High-end iOS Capacitor | Expensive to composite in WebKit even on fast hardware |
| `position: sticky`/`fixed` inside scroll containers or transformed ancestors | Both, differently | Known Blink/WebKit divergence in repaint behavior |
| Frequent `@capacitor/*` plugin calls in scroll/drag/per-frame handlers | High-end iOS Capacitor | Each call crosses the native bridge; cost is per-call, not per-CPU-cycle |
| Heavy main-thread JS on tap/scroll (large sync loops, unthrottled listeners) | Low-end Android | Weak CPU has no headroom to hide it |
| Layout thrash (`getBoundingClientRect`, `ResizeObserver`, auto-flip on open) | Both | Forces synchronous layout regardless of engine |
| Large eagerly-loaded assets/JS on cold start | Low-end Android (network), Capacitor (parse/hydrate) | Different bottleneck, same symptom: slow first paint |

## Out of scope

- The budgets/gates themselves (flag issues there, don't edit them).
- Non-visual business logic.
- Fully native code paths outside the WebView (Swift/Kotlin native
  screens, App Store/Play Store concerns) — this command covers the web
  content running inside both mobile web and the Capacitor shell, not the
  native shell itself.
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
- Chess board / celebration decorative motion — `@pkgs/chess-board`,
  `@libs/chess`
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
| Bridge cost | `@capacitor/*` (or other native plugin) calls inside scroll/drag/frame handlers |

Then check the platform-specific risk table above for anything the shared
patterns wouldn't catch.

### 3. Apply fixes

Rewrite toward static placement props, instant show/hide, and lean mount
paths. Prefer fixes that are cheap on both Blink and WebKit; if a fix must
trade one platform for the other, say so explicitly in the summary rather
than silently picking one. Update tests that asserted enter timing or
shift math. Leave Spinner, other genuine async signals, and intentional
native-feature calls untouched.

### 4. Verify

Run typecheck and focused tests for **every touched package**:

```sh
bun run --filter <package> tc
bun run --filter <package> test
```

Repeat for each `@pkgs/*`, `@libs/*`, or `@apps/*` package actually
touched — not just one.

For runtime changes, note in the summary whether verification was actually
exercised on both ends of the spectrum (CPU/network-throttled Chrome for
the Android floor; a WKWebView/Capacitor build via Safari's remote
inspector for the iOS ceiling) or only reasoned about — don't claim
verification you didn't do.

### 5. Summarize

End with:

- What became instant / static / direct (1–3 bullets)
- Packages touched
- Checks run, and which platform(s) they actually covered
- Any remaining jank risk you didn't fix, tagged by which end of the
  spectrum it affects (low-end Android, high-end iOS Capacitor, or both),
  including anything flagged as out-of-scope in step 1

## Failure / stop template

```
Stopped before finishing optimize.
Scope: <files or feature>
Blocked by: <human decision | incorrect gate | missing context>
Evidence: <what you found>
Next: <what a human should decide>
```