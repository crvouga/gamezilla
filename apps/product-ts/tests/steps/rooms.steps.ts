// @io-wall-ok — live health: Cloudflare API, room Durable Object wiring.
/** `specs/spaces/spaces.feature`. */

import { expect } from 'bun:test';
import { workerName } from '@libs/infra-shared-ts/wrangler';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
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

Then('spaces can open in this environment', async (w) => {
  const bindings = await scriptBindings(w.http, workerName(w.env));
  expect(bindings).toContainEqual(
    expect.objectContaining({
      type: 'durable_object_namespace',
      name: 'ROOM',
      class_name: ROOM_CLASS,
    })
  );
});

Then('the app can take people into a space', async (w) => {
  const bindings = await scriptBindings(w.http, workerName(w.env));
  expect(bindings).toContainEqual(
    expect.objectContaining({
      type: 'durable_object_namespace',
      name: 'ROOM',
      class_name: ROOM_CLASS,
    })
  );
});
