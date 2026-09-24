// @io-wall-ok — live smoke probe (EMQX broker on Railway).
import { describe, expect, test } from 'bun:test';
import { PubsubSecretName as Name } from '@libs/pubsub/public/secret-names';
import { createHttpPubSubFromSecretStore } from '@libs/pubsub/root/server/create-http-pubsub-from-secret-store';
import { pubsubEmqxSecretDefs } from '@libs/pubsub/shared/secrets/emqx-secret-defs';
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

/** Committed bootstrap values (`emqx-deploy/config`) that must never be live. */
async function committedDefault(name: string): Promise<string> {
  const def = pubsubEmqxSecretDefs.find((d) => d.name === name);
  return (await def?.seed?.({ secrets: new Map() })) ?? '';
}

describe('emqx', () => {
  test('HTTP API authenticates and every node is running', async () => {
    const res = await http.fetch(`${requireEnv(Name.apiUrl)}/api/v5/nodes`, {
      headers: { Authorization: basicAuth(), Accept: 'application/json' },
    });
    expect(res.status).toBe(200);
    const nodes = (await res.json()) as ReadonlyArray<{ node_status?: string }>;
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.map((n) => n.node_status)).toEqual(nodes.map(() => 'running'));
  });

  test('server publish path accepts a message', async () => {
    const pubsub = createHttpPubSubFromSecretStore({
      apiBaseUrl: requireEnv(Name.apiUrl),
      apiKey: requireEnv(Name.apiKey),
      apiSecret: requireEnv(Name.apiSecret),
    });
    await pubsub.publish('smoke-ping', { ok: true });
  });

  test('client WSS URL points at the broker host', () => {
    const wss = new URL(requireEnv(Name.wssUrl));
    expect(wss.protocol).toBe('wss:');
    expect(wss.hostname).toBe(new URL(requireEnv(Name.apiUrl)).hostname);
  });

  for (const name of [Name.apiKey, Name.apiSecret, Name.jwtSecret]) {
    test(`${name} is not the committed bootstrap default`, async () => {
      expect(requireEnv(name)).not.toBe(await committedDefault(name));
    });
  }
});
