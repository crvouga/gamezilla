#!/usr/bin/env bun
// @io-wall-ok — standalone process entry.
/**
 * Run the simulated Google IdP on its own port with its own SQLite state.
 *
 * `IDP_PORT=0` (the default) takes an OS-assigned port and prints the origin,
 * so several stacks can run at once.
 *
 * `IDP_STATE_MODE` selects durability:
 *   - `memory` (default) — an in-memory SQLite database; nothing is written.
 *   - any other value — a file, taken from `IDP_STATE_PATH`. The stack
 *     resolves that path for its `instance` mode; `path` is a caller-chosen
 *     file. Either way the child only ever sees "a file here".
 */

import { DEFAULT_IDP_ACCOUNTS } from '../src/server/index';
import {
  type IdpStateLocation,
  startGoogleIdpServer,
} from './start-idp-server';

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    process.stderr.write(`${name} is required when a file-backed IdP runs\n`);
    process.exit(1);
  }
  return value;
}

function resolveState(): IdpStateLocation {
  const mode = process.env['IDP_STATE_MODE'] ?? 'memory';
  if (mode === 'memory') return { kind: 'memory' };
  if (mode !== 'instance' && mode !== 'path') {
    process.stderr.write(
      `IDP_STATE_MODE must be memory, instance or path (got ${mode})\n`
    );
    process.exit(1);
  }
  return { kind: 'file', path: required('IDP_STATE_PATH') };
}

const port = Number(process.env['IDP_PORT'] ?? 0);
const clientId =
  process.env['IDP_CLIENT_ID'] ?? 'idp-google-sim.apps.googleusercontent.com';
const clientSecret =
  process.env['IDP_CLIENT_SECRET'] ?? 'idp-google-sim-secret';
const redirectUris = (process.env['IDP_REDIRECT_URIS'] ?? '')
  .split(',')
  .map((uri) => uri.trim())
  .filter((uri) => uri.length > 0);

const handle = await startGoogleIdpServer({
  port,
  state: resolveState(),
  clients: [
    {
      clientId,
      clientSecret,
      redirectUris,
      appName: process.env['IDP_APP_NAME'] ?? 'Localhost App',
    },
  ],
  accounts: DEFAULT_IDP_ACCOUNTS,
});

process.stdout.write(
  `${JSON.stringify({ origin: handle.origin, port: handle.port })}\n`
);

const stop = (): void => {
  void handle.stop().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
