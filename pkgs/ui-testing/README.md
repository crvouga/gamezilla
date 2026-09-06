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
| `AppHarness` | App-supplied bootstrap port (rntl only) |

Direct driver constructors are also available under deep imports, e.g.
`@pkgs/ui-testing/drivers/rntl/rntl-driver`.

## Architecture

```
Consumer (app / e2e package)
  ├── page objects (LoginPage, …)  — live in the consumer
  ├── AppHarness                   — createRoot / mount / setup / teardown
  └── createDriver({ kind, … })
        ├── SolidDomDriver    → harness.mount (Solid in happy-dom / browser DOM)
        ├── RntlDriver        → RenderAdapter (RNTL) or harness.mount
        └── BunWebviewDriver  → injected Bun.WebView
```

Dependency direction is always **apps → pkgs**. Drivers receive their underlying
handles (`Bun.WebView`, harness) from the consumer.

**No mocking of product deps.** RNTL rendering uses
[React Native Testing Library](https://oss.callstack.com/react-native-testing-library/)
over a real React Native host (`react-test-renderer` / `test-renderer`). Inject
alternate implementations via DI / harness setup — never `mock.module` or
hand-rolled module stubs in this package.

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

## RNTL driver

Boots a real React Native tree via RNTL — no browser, emulator, IPC,
or HTTP server, and no `react-native` → `react-native-web` remapping.

### 1. Implement an `AppHarness`

```ts
import { createElement } from 'react';
import type { AppHarness } from '@pkgs/ui-testing';
import { AppRoot } from './app-root'; // your app

export const harness: AppHarness = {
  async setup() {
    // DI seams, env, seed data — owned by the app
  },
  createRoot() {
    return createElement(AppRoot);
  },
  async teardown() {
    // dispose seams
  },
};
```

For Expo Router trees, prefer harness `mount()` with
`expo-router/testing-library` `renderRouter`, then wrap the result with
`createRenderedAppFromRntl`.

### 2. Write a test

```ts
import { createDriver } from '@pkgs/ui-testing';
import { harness } from './harness';

const driver = createDriver({
  kind: 'rntl',
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

| Operation | Solid DOM | RNTL | Bun.WebView |
| --- | --- | --- | --- |
| `launch` / `close` | yes | yes | yes (`baseUrl` optional) |
| `get` / nested `get` | yes | yes | yes |
| `tap` / `input` (auto-wait) | yes (user-event) | yes | yes |
| `tapAt` | yes (synthetic PointerEvents) | yes (RNGH / press+location) | yes |
| `drag` | yes (PointerEvent stream) | yes (RNGH pan stream) | yes |
| `layout` | yes (synthetic layout provider) | yes (style / synthetic onLayout) | yes |
| `clear` | yes | yes | yes |
| `key` (driver + node) | yes (user-event keyboard) | yes (no-op host) | yes |
| `scroll` | yes | yes | yes |
| `wait` / `isVisible` | MutationObserver + pump | virtual pump + query | `evaluate` poll |
| `expect.visible` / `hidden` / `text` | thin wrappers over `wait` | thin wrappers over `wait` | same |
| `text()` | yes | yes | yes |
| `snapshotHtml` | DOM → HTML | RN host → HTML | `documentElement.outerHTML` |

`DriverNode.wait` is host-native for speed: Solid DOM and rntl use a
constructor `pump` (sim virtual clock) instead of `findBy` / wall 50ms sleeps. Public options
are only `timeoutMs` / `description` — no shared poll interval.

### UI snapshots for reports

`Driver.snapshotHtml(options?)` / optional `RenderedApp.snapshotHtml(options?)`
produce a readable HTML preview of the current UI. Solid DOM serializes the
live document (plus body-level portals); RNTL serializes the
`react-test-renderer` host tree (component tags + inline styles from `style`
props) — not a browser DOM. Pass `stylesheetHref` to link shared shell CSS
instead of inlining it (used by `@pkgs/simulation` multi-frame reports).
Reporting wraps waits with `pollFrames` on the simulation recorder (not a
Driver poll hook).

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
```

Drivers live in sibling packages: `@pkgs/ui-testing-solid-dom` (Solid in a
DOM), `@pkgs/ui-testing-bun-webview` (`Bun.WebView`).
