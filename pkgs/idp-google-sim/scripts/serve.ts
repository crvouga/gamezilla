#!/usr/bin/env bun
// @io-wall-ok — standalone process entry.
/**
 * Run the simulated Google IdP on its own port with its own internal state.
 *
 * `IDP_PORT=0` (the default) takes an OS-assigned port and prints the origin,
 * so several stacks can run at once.
 */

import { startGoogleIdpServer } from './start-idp-server';

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
  clients: [
    {
      clientId,
      clientSecret,
      redirectUris,
      appName: process.env['IDP_APP_NAME'] ?? 'Localhost App',
    },
  ],
  accounts: [{ handle: 'alice' }, { handle: 'bob' }],
});

process.stdout.write(
  `${JSON.stringify({ origin: handle.origin, port: handle.port })}\n`
);

const stop = (): void => {
  void handle.stop().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
