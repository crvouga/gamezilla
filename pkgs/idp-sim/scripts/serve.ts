#!/usr/bin/env bun
// @io-wall-ok — standalone process entry.
/**
 * Run a simulated IdP on its own port with its own SQLite state.
 *
 * `IDP_PROVIDER` picks the wire: `google` (default) or `apple`. An Apple
 * provider also needs the relying party's Services ID registration:
 * `IDP_APPLE_TEAM_ID`, `IDP_APPLE_KEY_ID`, `IDP_APPLE_PUBLIC_JWK` (the public
 * half of the key the relying party signs its client secret with, as JSON),
 * and optionally `IDP_APPLE_NOTIFICATION_URL` for server-to-server events.
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

import { defaultAccountsFor } from '../src/server/index';
import type { IdpAppleClient, IdpProviderKind } from '../src/shared/index';
import { type IdpStateLocation, startIdpSimServer } from './start-idp-server';

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    process.stderr.write(`${name} is required\n`);
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

function resolveProvider(): IdpProviderKind {
  const raw = process.env['IDP_PROVIDER'] ?? 'google';
  if (raw === 'google' || raw === 'apple') return raw;
  process.stderr.write(`IDP_PROVIDER must be google or apple (got ${raw})\n`);
  return process.exit(1);
}

function resolveAppleClient(): IdpAppleClient {
  const notificationUrl = process.env['IDP_APPLE_NOTIFICATION_URL'] ?? '';
  return {
    teamId: required('IDP_APPLE_TEAM_ID'),
    keyId: required('IDP_APPLE_KEY_ID'),
    publicJwk: JSON.parse(required('IDP_APPLE_PUBLIC_JWK')) as Record<
      string,
      unknown
    >,
    notificationUrl: notificationUrl.length > 0 ? notificationUrl : null,
  };
}

const provider = resolveProvider();
const port = Number(process.env['IDP_PORT'] ?? 0);
const clientId =
  process.env['IDP_CLIENT_ID'] ?? 'idp-sim.apps.googleusercontent.com';
const clientSecret = process.env['IDP_CLIENT_SECRET'] ?? 'idp-sim-secret';
const redirectUris = (process.env['IDP_REDIRECT_URIS'] ?? '')
  .split(',')
  .map((uri) => uri.trim())
  .filter((uri) => uri.length > 0);

const handle = await startIdpSimServer({
  provider,
  port,
  state: resolveState(),
  clients: [
    {
      clientId,
      clientSecret,
      redirectUris,
      appName: process.env['IDP_APP_NAME'] ?? 'Localhost App',
      ...(provider === 'apple' ? { apple: resolveAppleClient() } : {}),
    },
  ],
  accounts: defaultAccountsFor(provider),
});

process.stdout.write(
  `${JSON.stringify({ origin: handle.origin, port: handle.port })}\n`
);

const stop = (): void => {
  void handle.stop().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
