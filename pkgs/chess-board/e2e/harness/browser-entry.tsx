/** @jsxImportSource solid-js */
// @io-wall-ok — browser composition root for the chess board harness page.
/**
 * Mounts the chess board harness in a real browser engine with wall time.
 * The scenario config arrives JSON-encoded in the URL hash, so every
 * `Bun.WebView` navigation mounts exactly the scenario a test asked for.
 */

import '@pkgs/tailwind/tailwind.css';
import '@pkgs/ui/tokens.css';
import '@pkgs/ui/base.css';

import { wallClock, wallTimers } from '@pkgs/clock';
import { render } from 'solid-js/web';

import { ChessBoardHarnessApp } from '../../tests/ui/harness/harness-app';
import { decodeHarnessConfig } from '../../tests/ui/harness/harness-config';

const root = document.getElementById('root');
if (root === null) throw new Error('chess board harness: missing #root');

render(
  () => (
    <ChessBoardHarnessApp
      config={decodeHarnessConfig(window.location.hash)}
      clock={wallClock}
      timers={wallTimers}
    />
  ),
  root
);
