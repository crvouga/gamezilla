import { scenarioAction } from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import { ApplySpaceMembership } from '@libs/spaces/public/room/space-membership-service';
import {
  ChangeCustomGame,
  type CustomGameChoice,
  CustomGamesChanged,
} from '../public/custom-game';

type Acknowledged = { commandId: string; choice: CustomGameChoice };
const acknowledged = new WeakMap<ProductHarness, Map<string, Acknowledged>>();

/** Capture the actual returned acknowledgement, together with its request. */
export function rememberCustomGameAcknowledgement(
  s: ProductHarness,
  spaceId: string,
  choice: CustomGameChoice
): void {
  const entries =
    s.harness.roomNode.exportTopic(`space:${spaceId}`)?.entries ?? [];
  const returned = entries.findLast((entry) =>
    CustomGamesChanged.is(entry.event)
  );
  if (returned === undefined || !CustomGamesChanged.is(returned.event))
    throw new Error('No Custom Game acknowledgement was returned');
  let rooms = acknowledged.get(s);
  if (rooms === undefined) {
    rooms = new Map();
    acknowledged.set(s, rooms);
  }
  rooms.set(spaceId, { commandId: returned.event.payload.commandId, choice });
}

/** Replay an acknowledged request with its original deduplication identity. */
export const repeatCustomGameAcknowledgement = scenarioAction({
  name: 'repeatCustomGameAcknowledgement',
  act: async (s, spaceId: string, initialMember: string) => {
    const topic = `space:${spaceId}`;
    const known = acknowledged.get(s)?.get(spaceId);
    if (known !== undefined) {
      await s.harness.roomNode.services.send(
        topic,
        known.commandId,
        ChangeCustomGame(known.choice)
      );
      return;
    }
    // Before a Custom Game exists, joining the space is already acknowledged.
    const outcomes = s.harness.roomNode.exportTopic(topic)?.dedup ?? {};
    const joined = Object.entries(outcomes).find(
      ([, result]) =>
        result.kind === 'committed' &&
        result.entries.some(
          (entry) =>
            entry.event.payload !== null &&
            typeof entry.event.payload === 'object' &&
            'memberId' in entry.event.payload &&
            entry.event.payload.memberId === initialMember
        )
    );
    if (joined === undefined)
      throw new Error('No acknowledged membership request');
    await s.harness.roomNode.services.send(
      topic,
      joined[0],
      ApplySpaceMembership({ memberId: initialMember, change: 'joined' })
    );
  },
});
