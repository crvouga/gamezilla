import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { Handles } from '@libs/test-ids-shared/handles';
import { openSpaceLink } from './space-actions';

/** Hold delivery after healthy reads; joining must not infer acceptance from those reads. */
export const askToJoinWithoutAnswer = scenarioAction({
  name: 'askToJoinWithoutAnswer',
  act: async (s, actorId: string, link: string) => {
    await Promise.resolve(openSpaceLink.act(s, actorId, link));
    const barrier = s.harness.net.holdHttp(actorId, '/api/mutations');
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.spaceJoin).tap({ timeoutMs: 15_000 });
    await pollUntil(
      s,
      async () => (barrier.requestsStarted() > 0 ? true : null),
      {
        maxMs: 5_000,
        description: 'join submitted without an answer',
      }
    );
  },
});

export async function joinUnconfirmedShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  await bringToFront(s, actorId);
  const ui = await actorUi(s, actorId);
  const text = await ui.get(Handles.spaceJoin).text();
  return text?.includes('Not confirmed') === true;
}
