// @io-wall-ok — live health probe (Cloudflare API: room Durable Object wiring).
import { describe, expect, test } from 'bun:test';
import { envFile } from '@libs/infra/public/envs';
import { workerName } from '@libs/infra/public/wrangler';
import { createGlobalHttpClient } from '@pkgs/http-client';

const CF_API = 'https://api.cloudflare.com/client/v4';
const ROOM_CLASS = 'RoomServerDurableObject';
const http = createGlobalHttpClient();

type Binding = {
  readonly type: string;
  readonly name: string;
  readonly class_name?: string;
  readonly script_name?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  expect(value, `${name} missing from secrets env`).not.toBe('');
  return value;
}

async function cf<T>(path: string): Promise<T> {
  const res = await http.fetch(
    `${CF_API}/accounts/${requireEnv('CLOUDFLARE_ACCOUNT_ID')}${path}`,
    {
      headers: {
        Authorization: `Bearer ${requireEnv('CLOUDFLARE_API_TOKEN')}`,
      },
    }
  );
  expect(res.status, `Cloudflare API ${path}`).toBe(200);
  return ((await res.json()) as { result: T }).result;
}

function scriptBindings(script: string): Promise<readonly Binding[]> {
  return cf<{ bindings: readonly Binding[] }>(
    `/workers/scripts/${script}/settings`
  ).then((r) => r.bindings);
}

const env = envFile(process.env['SECRETS_ENV']?.trim() || 'dev');

describe(`room worker (${env.env})`, () => {
  const roomWorker = workerName(env, 'room');
  const apiWorker = workerName(env, 'api');

  test(`${roomWorker} hosts the ${ROOM_CLASS} namespace`, async () => {
    const bindings = await scriptBindings(roomWorker);
    expect(bindings).toContainEqual(
      expect.objectContaining({
        type: 'durable_object_namespace',
        name: 'ROOM',
        class_name: ROOM_CLASS,
      })
    );
  });

  test(`${apiWorker} binds ROOM to ${roomWorker}`, async () => {
    const bindings = await scriptBindings(apiWorker);
    expect(bindings).toContainEqual(
      expect.objectContaining({
        type: 'durable_object_namespace',
        name: 'ROOM',
        class_name: ROOM_CLASS,
        script_name: roomWorker,
      })
    );
  });
});
