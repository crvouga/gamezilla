# `@pkgs/ui-testing-root-shared-ts`

Application-agnostic UI testing core. It models **user intent**, not browser
or DOM APIs, contains no product concepts, and imports nothing from `apps/`
or `libs/`. Drivers ship as their own packages so a suite loads only the
platform it drives:

| Driver | Package | Host |
| --- | --- | --- |
| `createSolidDomDriver` | [`@pkgs/ui-testing-solid-dom`](../ui-testing-solid-dom/README.md) | Solid in happy-dom (every `bun verify` UI suite) |
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
| `recordingDriver`, `StepRecorder` | Recording (below) |
| `UiOp`, `performUiOp` | Driver calls as replayable data |
| `waitUntil`, `TimeoutError`, `UiTestError`, … | Wait primitive and plain `Error` subclasses |

Every target is a `data-testid`. There is no `by.text` / `by.role` /
`by.label`. Page objects are the consumer's. No `mock.module`: alternate
implementations come in through DI at the harness.

`DriverNode.wait` is host-native: Solid DOM uses a `MutationObserver` plus an
injected `pump` (the harness's virtual clock), Bun.WebView polls `evaluate`.
Options are only `timeoutMs` / `description`.

## Recording

`recordingDriver(driver, { recorder })` hands every op to a `StepRecorder`
with its title and selector, so a host can log or time what a driver was
asked to do. Reads (`isVisible`, `text`, `layout`, `snapshotHtml`) pass
through unrecorded.

## Layout

```text
src/
  core/        errors, waitUntil, DriverKey
  selector/    formatTestId, formatTestIdPath
  driver/      Driver / DriverNode types
  assertions/  shared expect* helpers for DriverNode implementations
  bootstrap/   RenderedApp port
  explore/     exploration helpers
  record/      recordingDriver, UiOp
```

A new driver is a sibling package implementing `Driver`; assertions and page
objects do not change.
