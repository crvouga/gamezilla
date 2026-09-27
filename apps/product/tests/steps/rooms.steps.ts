// @io-wall-ok — live health: Cloudflare API, room Durable Object wiring.
/** `specs/health/rooms.feature`. */

import { expect } from 'bun:test';
import { workerName } from '@libs/infra/public/wrangler';
import type { HttpClient } from '@pkgs/http-client';
import { Then } from './define';
import { requireSecret } from './live-world';

const CF_API = 'https://api.cloudflare.com/client/v4';
const ROOM_CLASS = 'RoomServerDurableObject';

type Binding = {
  readonly type: string;
  readonly name: string;
  readonly class_name?: string;
  readonly script_name?: string;
};

async function scriptBindings(
  http: HttpClient,
  script: string
): Promise<readonly Binding[]> {
  const path = `/workers/scripts/${script}/settings`;
  const res = await http.fetch(
    `${CF_API}/accounts/${requireSecret('CLOUDFLARE_ACCOUNT_ID')}${path}`,
    {
      headers: {
        Authorization: `Bearer ${requireSecret('CLOUDFLARE_API_TOKEN')}`,
      },
    }
  );
  expect(res.status, `Cloudflare API ${path}`).toBe(200);
  return ((await res.json()) as { result: { bindings: readonly Binding[] } })
    .result.bindings;
}

Then('the room Worker hosts the room Durable Object namespace', async (w) => {
  const bindings = await scriptBindings(w.http, workerName(w.env, 'room'));
  expect(bindings).toContainEqual(
    expect.objectContaining({
      type: 'durable_object_namespace',
      name: 'ROOM',
      class_name: ROOM_CLASS,
    })
  );
});

Then('the API Worker binds its rooms to the room Worker', async (w) => {
  const bindings = await scriptBindings(w.http, workerName(w.env, 'api'));
  expect(bindings).toContainEqual(
    expect.objectContaining({
      type: 'durable_object_namespace',
      name: 'ROOM',
      class_name: ROOM_CLASS,
      script_name: workerName(w.env, 'room'),
    })
  );
});
