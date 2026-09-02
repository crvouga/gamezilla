import { AsyncLocalStorage } from '@pkgs/async-local';

/** Playwright-only: browser handle for the active test worker (opaque to ui-testing). */
export type UiTestHostState = {
  readonly browser?: unknown;
};

const storage = new AsyncLocalStorage<UiTestHostState>();

export function runWithUiTestHostState<T>(
  state: UiTestHostState,
  fn: () => T
): T {
  return storage.run(state, fn);
}

export async function runWithUiTestHostStateAsync<T>(
  state: UiTestHostState,
  fn: () => Promise<T>
): Promise<T> {
  return storage.run(state, fn);
}

export function getUiTestHostState(): UiTestHostState | undefined {
  return storage.getStore();
}

/** Browser from the active Playwright test, when fidelity is `max`. */
export function getUiTestBrowser(): unknown {
  return getUiTestHostState()?.browser;
}
