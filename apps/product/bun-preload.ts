// @io-wall-ok — bun:test preload; happy-dom globals and Lingui singleton pin
/**
 * bun:test preload for @apps/product — env, happy-dom as the global
 * `document` (Solid trees render into it via `MultiAppSolidDomSession`), and
 * one Lingui runtime per process.
 */

import { mock } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import * as linguiCore from '@lingui/core';
import * as linguiSolid from '@lingui/solid';

process.env['VITE_E2E'] = '1';
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env['SIM_WITH_DOM'] = process.env['SIM_WITH_DOM'] ?? '1';
if (process.env['SIM_REPORT'] === undefined) {
  process.env['SIM_REPORT'] = '0';
}

/** Phone viewport — `useLayoutMode` picks the compact tab bar. */
const PHONE_WINDOW = { width: 390, height: 844 };

/**
 * Bun natives that must survive happy-dom's global registration: the
 * in-process Hono server, sim HTTP serialization and the sim schedulers run in
 * this same process and rely on Bun's fetch / streams / timers / crypto, not
 * happy-dom's browser emulations.
 */
const KEEP_BUN_GLOBALS = [
  'fetch',
  'Request',
  'Response',
  'Headers',
  'FormData',
  'Blob',
  'File',
  'URL',
  'URLSearchParams',
  'TextEncoder',
  'TextDecoder',
  'AbortController',
  'AbortSignal',
  'ReadableStream',
  'WritableStream',
  'TransformStream',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'setImmediate',
  'clearImmediate',
  'queueMicrotask',
  'structuredClone',
  'crypto',
  'performance',
  'MessageChannel',
  'MessagePort',
  'BroadcastChannel',
  'WebSocket',
  'atob',
  'btoa',
] as const;

function registerHappyDom(): void {
  const saved = new Map<string, PropertyDescriptor>();
  for (const key of KEEP_BUN_GLOBALS) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    if (descriptor !== undefined) saved.set(key, descriptor);
  }
  GlobalRegistrator.register({
    ...PHONE_WINDOW,
    url: 'http://localhost:8081/',
  });
  for (const [key, descriptor] of saved) {
    Object.defineProperty(globalThis, key, descriptor);
  }
}

registerHappyDom();

// Pin Lingui to this process's singletons. bun's content-addressed install
// can resolve `@lingui/core` / `@lingui/solid` to distinct copies per
// workspace; the shell's `I18nProvider` context must be the one `@pkgs/ui`
// reads.
mock.module('@lingui/core', () => linguiCore);
mock.module('@lingui/solid', () => linguiSolid);
linguiCore.i18n.loadAndActivate({ locale: 'en', messages: {} });

if (typeof Symbol.dispose !== 'symbol') {
  Object.defineProperty(Symbol, 'dispose', {
    value: Symbol.for('Symbol.dispose'),
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
if (typeof Symbol.asyncDispose !== 'symbol') {
  Object.defineProperty(Symbol, 'asyncDispose', {
    value: Symbol.for('Symbol.asyncDispose'),
    configurable: true,
    enumerable: false,
    writable: false,
  });
}

require('@pkgs/logger').setDefaultLogLevel('error');

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
