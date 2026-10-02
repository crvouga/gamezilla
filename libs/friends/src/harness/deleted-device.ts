import {
  DEVICE_ID_KEY,
  SESSION_TOKEN_KEY,
} from '@libs/auth/public/auth-storage-keys';
import { ensureActor, scenarioAction } from '@libs/harness/system/actor-ui';
import { signInWithGoogleAsAccount } from '@libs/harness/system/auth-actions';
import type { ProductHarness } from '@libs/harness/system/harness';
import { createSpace } from '@libs/spaces/harness/space-actions';
import { readSpaceLink } from '@libs/spaces/harness/spaces-ui-reads';
export const prepareOldDevice = scenarioAction({
  name: 'prepareOldDevice',
  act: async (s, actor: string) => {
    await ensureActor(s, `${actor}_phone`);
    await Promise.resolve(
      signInWithGoogleAsAccount.act(s, `${actor}_phone`, actor)
    );
    s.harness.partition(`${actor}_phone`, 'server-a');
    s.harness.partition(`${actor}_phone`, 'server-b');
  },
});
export const tryDeletedDeviceJoin = scenarioAction({
  name: 'tryDeletedDeviceJoin',
  act: async (s, actor: string) => {
    await Promise.resolve(createSpace.act(s, 'bob'));
    const id = `${actor}_phone`;
    const env = await s.harness.client(id);
    const token = env.secureStorage.getValue(SESSION_TOKEN_KEY);
    const device = env.secureStorage.getValue(DEVICE_ID_KEY);
    const link = await readSpaceLink(s, 'bob');
    const spaceId = link?.split('/').at(-1);
    if (!spaceId) throw new Error('Open space missing');
    s.harness.heal(id, 'server-a');
    s.harness.heal(id, 'server-b');
    const response = await env.server('http://harness.local/api/mutations', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sync-protocol': '3',
        'x-anon-id': String(device),
        Authorization: `Bearer ${String(token)}`,
      },
      body: JSON.stringify({
        mutations: [
          {
            id: s.session.ports.createId(),
            name: 'joinSpace',
            args: { spaceId },
            clientId: String(device),
            seq: 1,
            createdAt: new Date(s.harness.clock.now()).toISOString(),
          },
        ],
      }),
    });
    s.probes.deletedDeviceReply = {
      status: response.status,
      body: await response.json(),
    };
  },
});
export const deletedDeviceReply = (s: ProductHarness) =>
  s.probes.deletedDeviceReply;
export const openDeletedProfile = scenarioAction({
  name: 'openDeletedProfile',
  act: async (s, actor: string, account: string) => {
    await ensureActor(s, actor);
    await s.actors.get(actor)!.openLink(`/profile/user/${account}`);
    await s.actors
      .get(actor)!
      .ui.get('friend-profile-unavailable')
      .expect.visible();
  },
});
export async function deletedProfileNotice(s: ProductHarness, actor: string) {
  return s.actors.get(actor)!.ui.get('friend-profile-unavailable').text();
}
