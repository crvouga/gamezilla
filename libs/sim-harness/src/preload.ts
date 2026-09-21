// @io-wall-ok — bun:test preload; product sim env, viewport and log noise
/**
 * bun:test preload for sim e2e suites, after `@pkgs/bun-test-solid/preload`
 * (Solid compile, happy-dom `document` — Solid trees render into it via
 * `MultiAppSolidDomSession` — and the Lingui pin): sim env, a phone
 * viewport, and quieter logs.
 */

import { setDomWindow } from '@pkgs/bun-test-solid/register';
import { setDefaultLogLevel } from '@pkgs/logger';

process.env['VITE_E2E'] = '1';
process.env['SIM_WITH_DOM'] = process.env['SIM_WITH_DOM'] ?? '1';
process.env['SIM_REPORT'] ??= '0';

// Phone viewport — `useLayoutMode` picks the compact tab bar.
setDomWindow({ width: 390, height: 844, url: 'http://localhost:8081/' });

setDefaultLogLevel('error');

const origError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const text = args
    .map((a) =>
      typeof a === 'string' ? a : a instanceof Error ? a.message : ''
    )
    .join(' ');
  if (text.includes('Cannot log after tests are done')) return;
  if (text.includes('Database is closed')) return;
  if (text.includes('createSim: server disposed')) return;
  origError(...args);
};
