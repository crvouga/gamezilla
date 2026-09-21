#!/usr/bin/env bun
// @io-wall-ok — standalone process entry.
/**
 * Run the mock billing provider on its own port with its own SQLite state.
 *
 * - `BILLING_MOCK_PORT` — `0` (default) takes an OS-assigned port.
 * - `BILLING_MOCK_CATALOG` — the catalog as JSON (`mockBillingCatalogFromOffer`).
 * - `BILLING_MOCK_SECRET_KEY` — the key `/v1/*` requires.
 * - `BILLING_MOCK_WEBHOOK_URL` / `BILLING_MOCK_WEBHOOK_SECRET` — where events go.
 * - `BILLING_MOCK_STATE_PATH` — a SQLite file; unset keeps state in memory.
 *
 * Prints `{ origin, port }` once listening.
 */
import type { MockBillingCatalog } from '@pkgs/billing-mock/catalog';

import { startMockBillingProviderServer } from './start-provider-server';

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    process.stderr.write(`${name} is required\n`);
    process.exit(1);
  }
  return value;
}

const webhookUrl = process.env['BILLING_MOCK_WEBHOOK_URL'] ?? '';
const statePath = process.env['BILLING_MOCK_STATE_PATH'] ?? '';

const handle = await startMockBillingProviderServer({
  port: Number(process.env['BILLING_MOCK_PORT'] ?? 0),
  catalog: JSON.parse(required('BILLING_MOCK_CATALOG')) as MockBillingCatalog,
  secretKey: required('BILLING_MOCK_SECRET_KEY'),
  webhook:
    webhookUrl.length === 0
      ? null
      : { url: webhookUrl, secret: required('BILLING_MOCK_WEBHOOK_SECRET') },
  state:
    statePath.length === 0
      ? { kind: 'memory' }
      : { kind: 'file', path: statePath },
});

process.stdout.write(
  `${JSON.stringify({ origin: handle.origin, port: handle.port })}\n`
);

const stop = (): void => {
  void handle.stop().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
