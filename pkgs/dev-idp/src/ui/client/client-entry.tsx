/** @jsxImportSource hono/jsx/dom */
/**
 * Browser bundle entry. Boots the two client islands declared in
 * {@link ../page.tsx}: the theme picker and the chooser app. Both
 * islands read their initial state from `window.__DEV_IDP_CONFIG__`
 * (serialized by the server JSX render), so no client-side fetch is
 * needed before the first paint.
 *
 * Bundled at server-startup via `Bun.build` (see
 * {@link ../../client-bundle.ts}) and served from `/dev-idp/client.js`.
 */
import { render } from 'hono/jsx/dom';

import type { DevIdpClientConfig } from '../page';
import { ChooserApp } from './chooser-app';
import { ThemePicker } from './theme-picker';

declare global {
  interface Window {
    __DEV_IDP_CONFIG__?: DevIdpClientConfig;
  }
}

function boot(): void {
  const config = window.__DEV_IDP_CONFIG__;
  if (config === undefined) {
    console.error('[dev-idp] missing window.__DEV_IDP_CONFIG__');
    return;
  }

  const themeMount = document.getElementById('dev-idp-theme-mount');
  if (themeMount !== null) {
    render(<ThemePicker />, themeMount);
  }

  const mainMount = document.getElementById('dev-idp-main-mount');
  if (mainMount !== null) {
    render(<ChooserApp config={config} />, mainMount);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
