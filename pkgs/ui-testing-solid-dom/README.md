# `@pkgs/ui-testing-solid-dom`

`Driver` / `DriverNode` implementation from `@pkgs/ui-testing` over a Solid
tree rendered into a DOM (happy-dom under `bun test`, via `@pkgs/bun-test-solid/preload`). `kind: 'solid-dom'`. It is
the in-process replacement for the old native driver: no
browser, emulator, IPC, or HTTP server.

- `get(testId)` resolves `[data-testid="…"]` inside the active actor's
  container first, then anywhere in `document.body` that is not another
  actor's mount (Solid `<Portal>` content lands outside the container).
- Visibility = attached, no `hidden` / `inert` / `aria-hidden="true"` ancestor,
  no `display:none` / `visibility:hidden` in inline or computed style.
- `tap` / `input` / `clear` / `key` go through `@testing-library/user-event`;
  `tapAt` / `drag` dispatch PointerEvents whose `clientX/Y` come from the
  element box. happy-dom rects are zero, so `ensureElementLayout` synthesizes a
  box (inline `px` size, else a `MULTI_APP_ACTOR_FRAME`-wide square) and installs
  it as the element's `getBoundingClientRect` — pass a `layoutProvider` to
  override.
- `wait(...)` is runtime-native: a `MutationObserver` on `document.body` plus
  an injected `pump` (the sim's `runFor(0)`) between checks, bounded by
  `timeoutMs` on an injected `Clock`. No `setTimeout` polling.
- `snapshotHtml()` serializes the actor container + body-level portal nodes
  into a standalone `<!DOCTYPE html>` document (`isBlankSnapshotHtml` filters
  empty shells).

## Single app

```ts
import { createSimClock } from '@pkgs/clock/sim-clock';
import { createSolidDomDriver } from '@pkgs/ui-testing-solid-dom';

const sim = createSimClock();
const driver = createSolidDomDriver({
  clock: sim.clock,
  pump: async () => sim.clock.advance(0),
  harness: { createRoot: () => () => <App /> },
});
await driver.launch();
await driver.get('submit').tap();
await driver.get('welcome').expect.text('Welcome');
await driver.close();
```

## Multi-actor session (sim hosts)

One `document.body`; each actor is a Solid component mounted into its own
`div[data-actor="<id>"]` under the session host. Only the focused actor is
mounted — parked actors dispose their root and keep their last non-blank
snapshot HTML.

```ts
import {
  createMultiAppSolidDomSession,
  createSolidDomDriver,
} from '@pkgs/ui-testing-solid-dom';

const session = createMultiAppSolidDomSession({
  onActorFocus: () => void runFor(1_000),
});

const driver = createSolidDomDriver({
  clock,                 // wall, or a virtual clock `runFor` advances
  pump: () => runFor(0), // drains sim work between wait checks
  harness: {
    mount: async () => {
      const app = session.mountActor(actorId, () => <ClientApp embedded />);
      await runFor(0);
      return app; // FocusedRenderedApp — activate() refocuses this actor
    },
  },
});

await session.snapshotAllActors({ stylesheetHref });
session.activeActorId();
session.clearFocus();
session.unmountActor(actorId);
session.dispose();
```
