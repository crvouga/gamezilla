import { partition } from '@libs/harness-ts/actions';
import { pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { deviceMemberIdOf } from '@libs/harness-ts/identity';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { askToJoinWithoutAnswer } from './space-join-interruption';

/** A fixture precondition: the real service accepted this person's join. */
async function joinAccepted(
  s: ProductHarness,
  actorId: string,
  link: string
): Promise<boolean> {
  const member = await deviceMemberIdOf(s, actorId);
  const id = /^\/space\/([^/?#]+)/.exec(link)?.[1];
  if (member === null || id === undefined)
    throw new Error('The join has no person or space');
  const rows = await s.harness.serverSql.sqlClient.query(sql<{ id: string }>`
    SELECT id FROM spaces_users WHERE space_id = ${id} AND user_id = ${member}
      AND joined = ${true} AND deleted_at IS NULL
  `);
  return rows.length === 1;
}

/** Accept through the mutation port, lose its answer, then keep the device offline. */
export const joinBeforeLosingAnswer = scenarioAction({
  name: 'joinBeforeLosingAnswer',
  act: async (s, actorId: string, link: string) => {
    await Promise.resolve(askToJoinWithoutAnswer.act(s, actorId, link));
    const barrier = s.harness.net.holdHttp(actorId, '/api/mutations');
    barrier.acceptWithoutAnswer();
    await pollUntil(
      s,
      async () => ((await joinAccepted(s, actorId, link)) ? true : null),
      {
        maxMs: 5_000,
        description: 'accepted join whose answer is held',
      }
    );
    await Promise.resolve(partition.act(s, actorId));
    // The real HTTP deadline aborts the held answer. The durable mutation remains queued.
    await s.session.advanceTime(11_000);
    s.harness.net.releaseHttp(actorId, '/api/mutations');
  },
});
