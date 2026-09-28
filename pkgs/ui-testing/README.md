# `@pkgs/ui-testing`

Application-agnostic cross-platform UI testing framework.

This package is designed as if it were an independent open-source library: it
contains **no product concepts**, imports nothing from `apps/` or `libs/`, and
models **user intent** rather than browser / DOM APIs. Suites run under
`bun:test`.

## Install (in this monorepo)

The package is a workspace member. Depend on it from a consuming package:

```json
{
  "dependencies": {
    "@pkgs/ui-testing": "workspace:*"
  }
}
```

## Public API

```ts
import {
  createDriver,
  type Driver,
  type DriverNode,
  type AppHarness,
} from '@pkgs/ui-testing';
```

| Surface | Purpose |
| --- | --- |
| `Driver` | Portable user-intent ops via locator nodes |
| `DriverNode` | Element-scoped tap / wait / expect / text |
| `createDriver(config)` | Factory over a discriminated `DriverConfig` |
| `driver.get(testId)` | Sync locator — never null; fails on action |
| `node.tap` / `input` / … | Actions on the resolved node |
| `node.expect.visible` / `hidden` / `text` | Nested assertions |
| `node.get(childTestId)` | Scope to a descendant |
| `AppHarness` | App-supplied bootstrap port (driver only) |



## Architecture

```
Consumer (app / e2e package)
  ├── page objects (LoginPage, …)  — live in the consumer
  ├── AppHarness                   — createRoot / mount / setup / teardown
  └── createDriver({ kind, … })
        ├── SolidDomDriver    → harness.mount (Solid in happy-dom / browser DOM)
        └── BunWebviewDriver  → injected Bun.WebView
```

Dependency direction is always **apps → pkgs**. Drivers receive their underlying
handles (`Bun.WebView`, harness) from the consumer.

**No mocking of product deps.** Rendering uses the host render adapter over a
real DOM host. Inject alternate implementations via DI / harness setup — never
`mock.module` or hand-rolled module stubs in this package.

## Targeting elements

Resolve targets with `driver.get(testId)` — a sync locator that chains for
nested scope:

```ts
await driver.get('submit').tap();
await driver.get('email').input('ada@example.com');
await driver.get('home').expect.visible();
await driver.get('modal').get('ok').expect.visible();
```

Every action and assertion maps to `testID` / `data-testid`.
There is no public `by.text` / `by.role` / `by.label` selection API.

`tap` and `input` auto-wait until the target is visible before acting
(optional `timeoutMs` via `UiWaitOptions`).

## Page objects (consumer-owned)

The framework ships **no** page objects. Build them in your app:

```ts
import type { Driver } from '@pkgs/ui-testing';

class LoginPage {
  constructor(private driver: Driver) {}

  async login(email: string, password: string) {
    await this.driver.get('email').input(email);
    await this.driver.get('password').input(password);
    await this.driver.get('submit').tap();
  }
}
```

## DOM driver

Boots a real DOM tree via the render adapter — no browser emulator or IPC.

### 1. Implement an `AppHarness`

```ts
import { render } from 'solid-js/web';
import type { AppHarness } from '@pkgs/ui-testing';
import { AppRoot } from './app-root'; // your app

export const harness: AppHarness = {
  async setup() {
    // DI seams, env, seed data — owned by the app
  },
  createRoot(container: HTMLElement) {
    return render(() => <AppRoot />, container);
  },
  async teardown() {
    // dispose seams
  },
};
```

### 2. Write a test

```ts
import { createDriver } from '@pkgs/ui-testing';
import { harness } from './harness';

const driver = createDriver({
  kind: 'solid-dom',
  harness,
  now: () => Date.now(),
  timers,
});
await driver.launch();
await driver.get('home').expect.visible();
await driver.close();
```

Wire I/O and storage through your harness / composition roots — the framework
does not stub native modules.

## Bun.WebView driver

Inject a `Bun.WebView` pointed at a localhost origin:

```ts
import { createDriver } from '@pkgs/ui-testing';

const view = new Bun.WebView({
  url: 'http://127.0.0.1:5173',
  width: 390,
  height: 844,
});
const driver = createDriver({
  kind: 'bun-webview',
  view,
  baseUrl: 'http://127.0.0.1:5173',
});
await driver.launch();
await driver.get('app-root').expect.visible();
```

## Driver capability matrix

| Operation | Solid DOM | Bun.WebView |
| --- | --- | --- |
| `launch` / `close` | yes | yes (`baseUrl` optional) |
| `get` / nested `get` | yes | yes |
| `tap` / `input` (auto-wait) | yes (user-event) | yes |
| `tapAt` (primary / secondary) | yes (synthetic PointerEvents) | yes (native click; re-sent if the page never saw it) |
| `drag` (primary / secondary) | yes (PointerEvent stream) | yes (PointerEvent stream) |
| `layout` | yes (synthetic layout provider) | yes |
| `clear` | yes | yes |
| `key` (driver + node; node focuses first) | yes (user-event keyboard) | yes |
| `scroll` | yes | yes |
| `wait` / `isVisible` | MutationObserver + pump | `evaluate` poll |
| `expect.visible` / `hidden` / `text` | thin wrappers over `wait` | same |
| `text()` | yes | yes |
| `snapshotHtml` | DOM → HTML | `documentElement.outerHTML` |

`DriverNode.wait` is host-native for speed: Solid DOM uses a constructor
`pump` (harness virtual clock) instead of `findBy` / wall 50ms sleeps. Public options
are only `timeoutMs` / `description` — no shared poll interval.

## Reporting (`@pkgs/ui-testing/report`)

Reporting is first-class: a harness wraps each actor's driver and every
user-intent op becomes a `@pkgs/harness` report step with its selector and press
`hit` (testId path + layout rect / tap point). UI steps snapshot before the
gesture so the HTML viewer can overlay the pressed element.

```ts
import { recordingDriver, type StepRecorder } from '@pkgs/ui-testing';

const recorder: StepRecorder = { record: (meta, fn) => run.record(meta, fn) };
const ui = recordingDriver(rawDriver, { recorder, actorId: 'alice' });
await ui.get('modal').get('ok').tap(); // step: ui "tap" testId("modal") >> testId("ok")
await ui.get('home').expect.visible(); // step: expect "expect visible" testId("home")
```

Reads (`isVisible`, `text`, `layout`, `snapshotHtml`) pass through unrecorded;
explore `inventory` is forwarded. `UiOp` + `performUiOp` / `describeUiOp` are
the data form of an op for explore walks and recordings.

`Driver.snapshotHtml(options?)` / optional `RenderedApp.snapshotHtml(options?)`
produce a readable HTML preview of the current UI (Solid DOM serializes the
live document plus body-level portals). Systems expose it through
`defineSnapshot({ media: 'html' })`; `@pkgs/harness-report` `writeHtmlReport` renders the
frames into one standalone `index.html`.

## Adding a future driver (Maestro, Appium, Cypress, …)

1. Implement `Driver` in `src/drivers/<name>/`
2. Add a member to `DriverConfig` in `create-driver.ts`
3. Export from `src/index.ts`
4. No change to assertions or page-object patterns

Assertions throw plain `Error` subclasses (`TimeoutError`, `UiTestError`, …).
There is no dependency on Vitest, Jest, or Bun's `expect` for driver assertions.

## Package layout

```text
pkgs/ui-testing/src/
  core/           errors, waitUntil, DriverKey
  selector/       formatTestId + formatTestIdPath + thin internal testId helper
  driver/         Driver interface + createDriver
  assertions/     shared expect* helpers for DriverNode implementations
  bootstrap/      AppHarness + RenderAdapter ports
  explore/        exploration helpers
  report/         recordingDriver (ops → report steps), UiOp
```

Drivers live in sibling packages: `@pkgs/ui-testing-solid-dom` (Solid in a
DOM), `@pkgs/ui-testing-bun-webview` (`Bun.WebView`).
