// @io-wall-ok — live health: the environment's EMQX broker.
/** `specs/health/realtime-broker.feature`. */

import { expect } from 'bun:test';
import { join } from 'node:path';
import { PubsubSecretName as Name } from '@libs/pubsub/public/secret-names';
import { createHttpPubSubFromSecretStore } from '@libs/pubsub/root/server/create-http-pubsub-from-secret-store';
import {
  COMMITTED_EMQX_CREDENTIALS,
  EMQX_STOCK_DASHBOARD_PASSWORD,
} from '@pkgs/emqx-server/ports';
import type { HttpClient } from '@pkgs/http-client';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs/repo-tree-store';
import { createSecretAdminStore } from '@pkgs/secret-provider';
import { eventually, Given, Then } from './define';
import { requireSecret } from './live-world';
import { wallWait } from './wall-wait';

const REPO_ROOT = join(import.meta.dir, '../../../..');
/** A broker OpenTofu just created (or restarted) builds for a few minutes. */
const BROKER_WARMUP_MS = 10 * 60 * 1000;
const RETRY_MS = 10_000;

function basicAuth(): string {
  return `Basic ${btoa(`${requireSecret(Name.apiKey)}:${requireSecret(Name.apiSecret)}`)}`;
}

async function nodeStatuses(
  http: HttpClient
): Promise<readonly string[] | null> {
  try {
    const res = await http.fetch(`${requireSecret(Name.apiUrl)}/api/v5/nodes`, {
      headers: { Authorization: basicAuth(), Accept: 'application/json' },
    });
    if (res.status !== 200) return null;
    const nodes = (await res.json()) as ReadonlyArray<{ node_status?: string }>;
    return nodes.map((n) => n.node_status ?? 'unknown');
  } catch {
    return null;
  }
}

/**
 * `secrets-run` injected this process's env once, at the start of the run;
 * `apply:foundation` may have replaced the broker credentials since (a
 * placeholder or `regenerate`d value), so probe with the store's live values.
 */
Given('the broker credentials are current from the secret store', async () => {
  const store = await createSecretAdminStore({
    repoRoot: REPO_ROOT,
    configStore: createRepoTreeObjectStore({ rootDir: REPO_ROOT }),
  });
  const live = await store.exportSecrets(process.env['SECRETS_ENV']);
  for (const name of Object.values(Name)) {
    const value = live.get(name)?.trim() ?? '';
    if (value.length > 0) process.env[name] = value;
  }
});

Then("the broker's API authenticates and every node is running", async (w) => {
  const seen: { statuses: readonly string[] | null } = { statuses: null };
  await eventually(
    async () => {
      seen.statuses = await nodeStatuses(w.http);
      return (
        seen.statuses !== null &&
        seen.statuses.length > 0 &&
        seen.statuses.every((s) => s === 'running')
      );
    },
    { maxWaitMs: BROKER_WARMUP_MS, retryMs: RETRY_MS, ...wallWait }
  );
  const last = seen.statuses;
  expect(last, 'EMQX API never authenticated').not.toBeNull();
  expect(last?.length ?? 0).toBeGreaterThan(0);
  expect(last).toEqual((last ?? []).map(() => 'running'));
});

Then("the server's publish path accepts a message", async () => {
  const pubsub = createHttpPubSubFromSecretStore({
    apiBaseUrl: requireSecret(Name.apiUrl),
    apiKey: requireSecret(Name.apiKey),
    apiSecret: requireSecret(Name.apiSecret),
  });
  await pubsub.publish('health-ping', { ok: true });
});

Then("the clients' WSS address points at the broker's host", () => {
  const wss = new URL(requireSecret(Name.wssUrl));
  expect(wss.protocol).toBe('wss:');
  expect(wss.hostname).toBe(new URL(requireSecret(Name.apiUrl)).hostname);
});

Then('the broker dashboard refuses the stock admin login', async (w) => {
  const res = await w.http.fetch(`${requireSecret(Name.apiUrl)}/api/v5/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: EMQX_STOCK_DASHBOARD_PASSWORD,
    }),
  });
  await res.body?.cancel();
  expect(res.status).toBe(401);
});

Then('no broker credential is one of the committed public credentials', () => {
  const committed = [
    Name.apiKey,
    Name.apiSecret,
    Name.jwtSecret,
    Name.dashboardPassword,
  ].filter((name) => COMMITTED_EMQX_CREDENTIALS.has(requireSecret(name)));
  expect(committed).toEqual([]);
});
