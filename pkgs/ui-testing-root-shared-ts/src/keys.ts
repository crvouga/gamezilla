/**
 * Portable key names. Drivers map these to their native key identifiers
 * (DOM `KeyboardEvent.key`, Bun.WebView, …).
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
  | 'home'
  | 'end'
  | 'space'
  | 'delete'
  | 'commandPalette'
  /** The letter keys games steer with beside the arrows. */
  | 'letterW'
  | 'letterA'
  | 'letterS'
  | 'letterD';

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
  home: 'Home',
  end: 'End',
  space: ' ',
  delete: 'Delete',
  commandPalette: 'Control+k',
  letterW: 'w',
  letterA: 'a',
  letterS: 's',
  letterD: 'd',
};
