/**
 * The server's boot state, read back by the browser app.
 *
 * The shell writes `IdpScreenState` as JSON next to the markup, so a browser
 * that runs the app never has to re-ask for the screen it was just served.
 */

import {
  IDP_BOOT_STATE_ELEMENT_ID,
  type IdpScreenState,
} from '../../src/shared/screen-state';

const KINDS: readonly string[] = [
  'identifier',
  'password',
  'chooser',
  'create-account',
  'consent',
  'error',
];

/** Parse the injected JSON, refusing anything that is not a known screen. */
export function parseScreenState(raw: unknown): IdpScreenState {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('idp: malformed boot state');
  }
  const kind: unknown = Reflect.get(raw, 'kind');
  if (typeof kind !== 'string' || !KINDS.includes(kind)) {
    throw new Error(`idp: unknown screen kind ${String(kind)}`);
  }
  return raw as IdpScreenState;
}

export function readBootState(): IdpScreenState {
  const element = document.getElementById(IDP_BOOT_STATE_ELEMENT_ID);
  const text = element?.textContent ?? null;
  if (text === null || text.length === 0) {
    throw new Error('idp: missing boot state');
  }
  return parseScreenState(JSON.parse(text) as unknown);
}
