# `@pkgs/ui-testing`

Application-agnostic cross-platform UI testing framework.

This package is designed as if it were an independent open-source library: it
contains **no product concepts**, imports nothing from `apps/` or `libs/`, and
models **user intent** rather than Playwright / Detox / DOM APIs.

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
  by,
  expectVisible,
  expectHidden,
  expectText,
  type Driver,
  type AppHarness,
} from '@pkgs/ui-testing';
```

| Surface | Purpose |
| --- | --- |
| `Driver` | Portable user-intent operations |
| `createDriver(config)` | Factory over a discriminated `DriverConfig` |
| `by.testId` / `by.text` / `by.label` / `by.role` | Selector builders |
| `expectVisible` / `expectHidden` / `expectText` | Runner-agnostic assertions |
| `AppHarness` | App-supplied bootstrap port (in-process only) |

Direct driver constructors are also available under deep imports, e.g.
`@pkgs/ui-testing/drivers/in-process/in-process-driver`.

## Architecture

```
Consumer (app / e2e package)
  ├── page objects (LoginPage, …)  — live in the consumer
  ├── AppHarness                   — createRoot / setup / teardown
  └── createDriver({ kind, … })
        ├── InProcessDriver  → RenderAdapter (react-native-web + Testing Library DOM)
        ├── PlaywrightDriver → injected Playwright Page
        └── DetoxDriver      → stub (documented Detox mapping)
```

Dependency direction is always **apps → pkgs**. Drivers receive their underlying
handles (`Page`, Detox device, harness) from the consumer.

## Selectors

```ts
by.testId('email')
by.text('Sign in')
by.label('Password')
by.role('button', 'Submit')
first(by.role('heading', 'Spaces'))
nth(by.testId('row'), 2)
```

Drivers translate these into native queries (`getByTestId`, Detox `by.id`, …).
Never pass CSS / XPath / framework matchers into the public API.
Use `first` / `nth` when multiple elements match.

## Page objects (consumer-owned)

The framework ships **no** page objects. Build them in your app:

```ts
import { by, type Driver } from '@pkgs/ui-testing';

class LoginPage {
  constructor(private driver: Driver) {}

  async login(email: string, password: string) {
    await this.driver.typeText(by.testId('email'), email);
    await this.driver.typeText(by.testId('password'), password);
    await this.driver.tap(by.role('button', 'Submit'));
  }
}
```

## In-process driver

Boots a real React / React Native (web) tree inside one Node/Bun process —
no browser, emulator, IPC, or HTTP server.

### 1. Implement an `AppHarness`

```ts
import { createElement } from 'react';
import type { AppHarness } from '@pkgs/ui-testing';
import { AppRoot } from './app-root'; // your app

export const harness: AppHarness = {
  async setup() {
    // fakes, env, seed data — owned by the app
  },
  createRoot() {
    return createElement(AppRoot);
  },
  async teardown() {
    // dispose fakes
  },
};
```

### 2. Preload happy-dom + react-native → react-native-web

Add a `bunfig.toml` next to the tests that use the in-process driver:

```toml
[test]
preload = ["../../pkgs/ui-testing/src/drivers/in-process/bun-preload.ts"]
```

Or re-export that preload from your own package. The preload:

1. Registers happy-dom globals before Testing Library evaluates
2. Aliases `react-native` → `react-native-web` via `mock.module`

### 3. Write a test (any runner)

```ts
import { createDriver, by, expectVisible } from '@pkgs/ui-testing';
import { harness } from './harness';

const driver = createDriver({ kind: 'in-process', harness });
await driver.launch();
await expectVisible(driver, by.testId('home'));
await driver.close();
```

Native-only modules (SQLite, gestures, …) must be doubled in your harness —
the framework does not know about them.

An alternate `RenderAdapter` (e.g. React Native Testing Library under Jest)
can be passed as `renderer` without changing the `Driver` API.

## Playwright driver

Inject a Playwright `Page`. The package depends on `@playwright/test` as a
**type-only** / devDependency — consumers already using Playwright pay nothing
extra at runtime beyond their own install.

```ts
import { test } from '@playwright/test';
import { createDriver, by, expectVisible } from '@pkgs/ui-testing';

test('home loads', async ({ page }) => {
  const driver = createDriver({
    kind: 'playwright',
    page,
    baseUrl: 'http://localhost:5173',
  });
  await driver.launch();
  await expectVisible(driver, by.testId('app-root'));
});
```

## Detox driver (stub)

`DetoxDriver` satisfies the `Driver` interface and documents the Detox mapping
for every operation, but throws `NotImplementedError` until a consumer that
owns the `detox` dependency completes the integration. Classic Detox has no
first-class text read-back — `getText` remains unsupported by design.

## Driver capability matrix

| Operation | In-process | Playwright | Detox (stub) |
| --- | --- | --- | --- |
| `launch` / `close` | yes | yes (`baseUrl` optional) | stub → `device.launchApp` / `terminateApp` |
| `tap` | yes | yes | stub → `element().tap()` |
| `tapAt` | yes | yes | stub → `element().tap({ x, y })` |
| `typeText` / `clearText` | yes | yes | stub → `typeText` / `clearText` |
| `pressKey` | yes | yes | stub (platform-limited) |
| `scroll` | yes | yes | stub → `element().scroll` |
| `navigateBack` | not implemented* | `page.goBack()` | stub → `device.pressBack()` |
| `waitFor` / `isVisible` | yes | yes | stub → `waitFor` / `toBeVisible` |
| `getText` | yes | yes | unsupported in Detox |

\*In-process `navigateBack` needs app-level back handling (router / page object).

## Adding a future driver (Maestro, Appium, Cypress, …)

1. Implement `Driver` in `src/drivers/<name>/`
2. Add a member to `DriverConfig` in `create-driver.ts`
3. Export from `src/index.ts`
4. No change to selectors, assertions, or page-object patterns

## Test runner independence

Assertions and `waitUntil` throw plain `Error` subclasses
(`TimeoutError`, `UiTestError`, …). There is no dependency on Vitest, Jest, or
Bun's `expect` — use whatever runner you prefer.

## Package layout

```text
pkgs/ui-testing/src/
  core/           errors, waitUntil, DriverKey
  selector/       Selector union + by.* builders
  driver/         Driver interface + createDriver
  assertions/     expectVisible / expectHidden / expectText
  bootstrap/      AppHarness + RenderAdapter ports
  drivers/
    in-process/   InProcessDriver + DOM renderer + bun preload
    playwright/   PlaywrightDriver
    detox/        DetoxDriver stub
```
