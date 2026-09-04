# `@pkgs/ui-testing`

Application-agnostic cross-platform UI testing framework.

This package is designed as if it were an independent open-source library: it
contains **no product concepts**, imports nothing from `apps/` or `libs/`, and
models **user intent** rather than browser / Detox / DOM APIs. Suites run under
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
        ├── RntlDriver        → RenderAdapter (RNTL) or harness.mount
        ├── BunWebviewDriver  → injected Bun.WebView
        └── DetoxDriver       → stub (documented Detox mapping)
```

Dependency direction is always **apps → pkgs**. Drivers receive their underlying
handles (`Bun.WebView`, Detox device, harness) from the consumer.

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

Every action and assertion maps to `testID` / `data-testid` / Detox `by.id`.
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

## Detox driver (stub)

`DetoxDriver` satisfies the `Driver` interface and documents the Detox mapping
for every operation, but throws `NotImplementedError` until a consumer that
owns the `detox` dependency completes the integration. Classic Detox has no
first-class text read-back — `text()` remains unsupported by design.

## Driver capability matrix

| Operation | RNTL | Bun.WebView | Detox (stub) |
| --- | --- | --- | --- |
| `launch` / `close` | yes | yes (`baseUrl` optional) | stub → `device.launchApp` / `terminateApp` |
| `get` / nested `get` | yes | yes | stub → `by.id` / `withDescendant` |
| `tap` / `input` (auto-wait) | yes | yes | stub → `element().tap()` / `typeText` |
| `tapAt` | yes (RNGH / press+location) | yes | stub → `element().tap({ x, y })` |
| `drag` | yes (RNGH pan stream) | yes | stub → `longPressAndDrag` |
| `layout` | yes (style / synthetic onLayout) | yes | stub → `getAttributes` |
| `clear` | yes | yes | stub → `clearText` |
| `key` (driver + node) | yes (no-op host) | yes | stub (platform-limited) |
| `scroll` | yes | yes | stub → `element().scroll` |
| `wait` / `isVisible` | virtual pump + query | `evaluate` poll | stub → native `waitFor` |
| `expect.visible` / `hidden` / `text` | thin wrappers over `wait` | same | stub |
| `text()` | yes | yes | unsupported in Detox |
| `snapshotHtml` | RN host → HTML | `documentElement.outerHTML` | returns `null` |

`DriverNode.wait` is host-native for speed: rntl uses a constructor `pump`
(sim virtual clock) instead of RNTL `findBy` / wall 50ms sleeps. Public options
are only `timeoutMs` / `description` — no shared poll interval.

### UI snapshots for reports

`Driver.snapshotHtml(options?)` / optional `RenderedApp.snapshotHtml(options?)`
produce a readable HTML preview of the current UI. RNTL serializes the
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
  drivers/
    rntl/         RntlDriver + RNTL renderer + RntlDriverNode
    bun-webview/  BunWebviewDriver + BunWebviewDriverNode
    detox/        DetoxDriver stub
```
