# `@pkgs/ui-testing-root-shared`

Application-agnostic UI testing core. It models **user intent**, not browser
or DOM APIs, contains no product concepts, and imports nothing from `apps/`
or `libs/`. Drivers ship as their own packages so a suite loads only the
platform it drives:

| Driver | Package | Host |
| --- | --- | --- |
| `createSolidDomDriver` | [`@pkgs/ui-testing-solid-dom`](../ui-testing-solid-dom/README.md) | Solid in happy-dom (every `bun check-pr` UI suite) |
| `BunWebviewDriver` | `@pkgs/ui-testing-bun-webview` | `Bun.WebView` (opt-in live-browser harnesses) |

A suite is written once against `Driver`; swapping hosts is a driver choice,
never a suite rewrite.

## Surface

| Export | Purpose |
| --- | --- |
| `Driver` / `DriverNode` | Portable user-intent ops via locator nodes |
| `driver.get(testId)` | Sync locator, never null; fails on action. Chains: `get('modal').get('ok')` |
| `node.tap` / `input` / `clear` / `key` / `tapAt` / `drag` / `scroll` | Actions; `tap` and `input` auto-wait for visibility (`timeoutMs`) |
| `node.expect.visible` / `hidden` / `text` | Assertions (thin wrappers over `wait`) |
| `RenderedApp` / `HostNode` | The mounted-tree port drivers talk through |
| `recordingDriver`, `UiOp`, `performUiOp`, `describeUiOp` | Reporting (below) |
| `waitUntil`, `TimeoutError`, `UiTestError`, … | Wait primitive and plain `Error` subclasses |

Every target is a `data-testid`. There is no `by.text` / `by.role` /
`by.label`. Page objects are the consumer's. No `mock.module`: alternate
implementations come in through DI at the harness.

`DriverNode.wait` is host-native: Solid DOM uses a `MutationObserver` plus an
injected `pump` (the harness's virtual clock), Bun.WebView polls `evaluate`.
Options are only `timeoutMs` / `description`.

## Reporting

A harness wraps each actor's driver so every op becomes a `@pkgs/harness-root-shared`
report step with its selector and press `hit` (testId path, layout rect, tap
point). UI steps snapshot before the gesture so the report viewer can overlay
the pressed element.

```ts
import { recordingDriver, type StepRecorder } from '@pkgs/ui-testing-root-shared';

const recorder: StepRecorder = { record: (meta, fn) => run.record(meta, fn) };
const ui = recordingDriver(rawDriver, { recorder, actorId: 'alice' });
await ui.get('modal').get('ok').tap(); // step: ui "tap" testId("modal") >> testId("ok")
```

Reads (`isVisible`, `text`, `layout`, `snapshotHtml`) pass through
unrecorded. `Driver.snapshotHtml()` feeds `defineSnapshot({ media: 'html' })`;
`@pkgs/harness-report` renders the frames.

## Layout

```text
src/
  core/        errors, waitUntil, DriverKey
  selector/    formatTestId, formatTestIdPath
  driver/      Driver / DriverNode types
  assertions/  shared expect* helpers for DriverNode implementations
  bootstrap/   RenderedApp port
  explore/     exploration helpers
  report/      recordingDriver, UiOp
```

A new driver is a sibling package implementing `Driver`; assertions and page
objects do not change.
