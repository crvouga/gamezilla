/**
 * Portable key names. Drivers map these to their native key identifiers
 * (DOM `KeyboardEvent.key`, Bun.WebView, Detox, …).
 */
export type DriverKey =
  | 'enter'
  | 'backspace'
  | 'tab'
  | 'escape'
  | 'arrowUp'
  | 'arrowDown'
  | 'arrowLeft'
  | 'arrowRight'
  | 'space'
  | 'delete';

/** DOM `KeyboardEvent.key` identifiers for each {@link DriverKey}. */
export const DRIVER_KEY_TO_DOM: Record<DriverKey, string> = {
  enter: 'Enter',
  backspace: 'Backspace',
  tab: 'Tab',
  escape: 'Escape',
  arrowUp: 'ArrowUp',
  arrowDown: 'ArrowDown',
  arrowLeft: 'ArrowLeft',
  arrowRight: 'ArrowRight',
  space: ' ',
  delete: 'Delete',
};
