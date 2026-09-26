// @io-wall-ok — live health probe (EMQX broker on Railway).
import { describe, expect, test } from 'bun:test';
import { PubsubSecretName as Name } from '@libs/pubsub/public/secret-names';
import { createHttpPubSubFromSecretStore } from '@libs/pubsub/root/server/create-http-pubsub-from-secret-store';
import {
  COMMITTED_EMQX_CREDENTIALS,
  EMQX_STOCK_DASHBOARD_PASSWORD,
} from '@libs/pubsub/shared/secrets/emqx-credentials';
import { wallClock, wallTimers } from '@pkgs/clock';
import { createGlobalHttpClient } from '@pkgs/http-client';

const http = createGlobalHttpClient();

function requireEnv(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  expect(value, `${name} missing from secrets env`).not.toBe('');
  return value;
}

function basicAuth(): string {
  return `Basic ${btoa(`${requireEnv(Name.apiKey)}:${requireEnv(Name.apiSecret)}`)}`;
}

/**
 * Every environment runs its own broker (libs/infra/tofu/modules/pubsub);
 * OpenTofu writes its credentials before `health` runs.
 */
/** A broker OpenTofu just created (or restarted) builds for a few minutes. */
const WARMUP_MS = 10 * 60 * 1000;
const RETRY_MS = 10_000;

async function nodeStatuses(): Promise<readonly string[] | null> {
  try {
    const res = await http.fetch(`${requireEnv(Name.apiUrl)}/api/v5/nodes`, {
      headers: { Authorization: basicAuth(), Accept: 'application/json' },
    });
    if (res.status !== 200) return null;
    const nodes = (await res.json()) as ReadonlyArray<{ node_status?: string }>;
    return nodes.map((n) => n.node_status ?? 'unknown');
  } catch {
    return null;
  }
}

async function runningNodes(): Promise<readonly string[] | null> {
  const deadline = wallClock.now() + WARMUP_MS;
  for (;;) {
    const statuses = await nodeStatuses();
    const ready =
      statuses !== null &&
      statuses.length > 0 &&
      statuses.every((s) => s === 'running');
    if (ready || wallClock.now() >= deadline) return statuses;
    await new Promise<void>((resolve) => {
      wallTimers.setTimeout(() => resolve(), RETRY_MS);
    });
  }
}

describe('emqx', () => {
  test(
    'HTTP API authenticates and every node is running',
    async () => {
      const statuses = await runningNodes();
      expect(statuses, 'EMQX API never authenticated').not.toBeNull();
      expect(statuses?.length ?? 0).toBeGreaterThan(0);
      expect(statuses).toEqual((statuses ?? []).map(() => 'running'));
    },
    WARMUP_MS + 60_000
  );

  test('server publish path accepts a message', async () => {
    const pubsub = createHttpPubSubFromSecretStore({
      apiBaseUrl: requireEnv(Name.apiUrl),
      apiKey: requireEnv(Name.apiKey),
      apiSecret: requireEnv(Name.apiSecret),
    });
    await pubsub.publish('health-ping', { ok: true });
  });

  test('client WSS URL points at the broker host', () => {
    const wss = new URL(requireEnv(Name.wssUrl));
    expect(wss.protocol).toBe('wss:');
    expect(wss.hostname).toBe(new URL(requireEnv(Name.apiUrl)).hostname);
  });

  test('dashboard rejects the stock admin login', async () => {
    const res = await http.fetch(`${requireEnv(Name.apiUrl)}/api/v5/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: EMQX_STOCK_DASHBOARD_PASSWORD,
      }),
    });
    expect(res.status).toBe(401);
  });

  for (const name of [
    Name.apiKey,
    Name.apiSecret,
    Name.jwtSecret,
    Name.dashboardPassword,
  ]) {
    test(`${name} is not a committed (public) credential`, () => {
      expect(COMMITTED_EMQX_CREDENTIALS.has(requireEnv(name))).toBe(false);
    });
  }
});
