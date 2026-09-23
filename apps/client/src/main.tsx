/** @jsxImportSource solid-js */
// @io-wall-ok — browser composition root
/**
 * Web entry: builds the wall `ClientEnv` from browser APIs, creates the
 * client and mounts `client.App` (browser `Router`; the URL is the source of
 * truth). `pagehide` releases the sync engines (web OPFS handles).
 */

import { wallTimers } from '@pkgs/clock/wall';
import { render } from 'solid-js/web';

import '@pkgs/tailwind/tailwind.css';
import '@pkgs/ui/tokens.css';
import '@pkgs/ui/base.css';
import { createClient } from './shell/create-client';
import { wallClientEnv } from './shell/wall-client-env';
import { handOffPopupAuthCallback } from './shell/wall-open-auth-session';

function startClient(): void {
  const root = document.getElementById('root');
  if (root === null) {
    throw new Error('#root element missing from index.html');
  }

  const client = createClient(wallClientEnv(), {
    poolGlobalKey: '__gamezilla_sync_engine_pool__',
  });

  window.addEventListener('pagehide', () => {
    void client.close();
  });

  render(() => <client.App />, root);
}

if (!handOffPopupAuthCallback(wallTimers)) startClient();
