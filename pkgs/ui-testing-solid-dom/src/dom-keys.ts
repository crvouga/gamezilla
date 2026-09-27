import { DRIVER_KEY_TO_DOM, type DriverKey } from '@pkgs/ui-testing/core/keys';

/** `@testing-library/user-event` keyboard descriptors per portable key. */
export const DRIVER_KEY_TO_USER_EVENT: Record<DriverKey, string> = {
  enter: '{Enter}',
  backspace: '{Backspace}',
  tab: '{Tab}',
  escape: '{Escape}',
  arrowUp: '{ArrowUp}',
  arrowDown: '{ArrowDown}',
  arrowLeft: '{ArrowLeft}',
  arrowRight: '{ArrowRight}',
  home: '{Home}',
  end: '{End}',
  space: '[Space]',
  delete: '{Delete}',
};

/** Reverse map: DOM `KeyboardEvent.key` → user-event descriptor. */
export function userEventKeyFromDom(domKey: string): string {
  for (const [driverKey, mapped] of Object.entries(DRIVER_KEY_TO_DOM)) {
    if (mapped === domKey) {
      return DRIVER_KEY_TO_USER_EVENT[driverKey as DriverKey];
    }
  }
  // Single printable characters type as-is; escape user-event's brackets.
  return domKey.replace(/[{[]/g, '$&$&');
}

/** Escape `{` / `[` so free text is typed literally by user-event. */
export function escapeUserEventText(text: string): string {
  return text.replace(/[{[]/g, '$&$&');
}
