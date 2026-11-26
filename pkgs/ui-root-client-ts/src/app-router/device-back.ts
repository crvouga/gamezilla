import { browserHistory } from '@solidjs/router';
import { createContext, createEffect, useContext } from 'solid-js';

type Register = (handler: () => void, fallback: string) => () => void;
export const DeviceBackContext = createContext<Register | null>(null);

/** Give an embedded screen the browser's Back gesture while its handler is active. */
export function useDeviceBack(
  handler: () => (() => void) | undefined,
  fallback: string
): void {
  const register = useContext(DeviceBackContext);
  createEffect(handler, (active) => active && register?.(active, fallback));
}

/** Give a directly opened document an in-app predecessor for a same-document Back event. */
export function prepareDeviceBack(fallback: string): void {
  const history = browserHistory();
  const entry = history.get();
  if (typeof entry === 'string') return;
  const state =
    typeof entry.state === 'object' && entry.state !== null ? entry.state : {};
  if ('deviceBackFallback' in state && state.deviceBackFallback === fallback)
    return;
  history.set({ value: fallback, replace: true, scroll: false });
  history.set({
    ...entry,
    state: { ...state, deviceBackFallback: fallback },
    scroll: false,
  });
}
