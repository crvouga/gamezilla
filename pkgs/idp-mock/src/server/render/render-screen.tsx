/**
 * Server rendering: the same Solid tree the browser mounts, serialized.
 *
 * Both hosts share one compile contract (`babel-preset-solid`, DOM output), so
 * the server renders {@link Screen} into a DOM and reads back `innerHTML`
 * rather than using Solid's SSR transform — one component graph, one set of
 * attributes, no divergence between what a browser without JavaScript sees and
 * what the SPA mounts.
 *
 * The document comes from the host's preload (`@pkgs/bun-test-solid/register`
 * registers happy-dom); this module refuses to render without one, because registering
 * globals in the middle of a request would replace Bun's own `fetch`, `Request`
 * and timers under the running server.
 */

import { render } from 'solid-js/web';
import { Screen } from '../../../web/src/screen';
import { IDP_ASSET_JS_PATH, IDP_FAVICON_PATH } from '../../shared/paths';
import {
  IDP_BOOT_STATE_ELEMENT_ID,
  IDP_NOOP_SCREEN_ACTIONS,
  type IdpScreenState,
  titleOf,
} from '../../shared/screen-state';
import type { IdpProviderKind } from '../../shared/types';
import { IDP_SPA_CSS } from '../assets.generated';

/** Injected verbatim into `<script type="application/json">`. */
function bootStateJson(state: IdpScreenState): string {
  return JSON.stringify(state)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/**
 * The one shell. The CSS is inlined (removing a render-blocking round trip and
 * keeping the first paint identical to the no-JS view) and the JS is one cached
 * request served from the embedded bundle.
 */
function shell(
  state: IdpScreenState,
  provider: IdpProviderKind,
  markup: string
): string {
  return [
    `<!DOCTYPE html><html lang="en" data-idp-provider="${provider}"><head><meta charset="utf-8">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(titleOf(state))}</title>`,
    `<link rel="icon" href="${IDP_FAVICON_PATH}" type="image/svg+xml">`,
    `<style>${IDP_SPA_CSS}</style>`,
    `</head><body><div id="idp-root">${markup}</div>`,
    `<script type="application/json" id="${IDP_BOOT_STATE_ELEMENT_ID}">`,
    `${bootStateJson(state)}</script>`,
    `<script type="module" src="${IDP_ASSET_JS_PATH}"></script>`,
    '</body></html>',
  ].join('');
}

export async function renderScreenHtml(
  state: IdpScreenState,
  provider: IdpProviderKind
): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error(
      'idp: no DOM — preload @pkgs/bun-test-solid/register before rendering screens'
    );
  }
  const container = document.createElement('div');
  const dispose = render(
    () => (
      <Screen
        state={state}
        provider={provider}
        actions={IDP_NOOP_SCREEN_ACTIONS}
        busy={false}
      />
    ),
    container
  );
  const markup = container.innerHTML;
  dispose();
  return shell(state, provider, markup);
}
