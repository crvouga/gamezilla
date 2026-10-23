import type { CustomGameChoice } from '@libs/game-session-shared-ts/custom-game-choice';
import {
  ChangeCustomGame,
  CustomGamesChanged,
} from '@libs/game-session-shared-ts/custom-game-commands';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { ApplySpaceMembership } from '@libs/spaces-shared-ts/space-service-command';

type Acknowledged = { commandId: string; choice: CustomGameChoice };
const acknowledged = new WeakMap<ProductHarness, Map<string, Acknowledged>>();

/** Capture the actual returned acknowledgement, together with its request. */
export function customGameAcknowledgementTip(
  s: ProductHarness,
  spaceId: string
): number {
  return (
    s.harness.roomNode.exportTopic(`space:${spaceId}`)?.entries.at(-1)?.seq ?? 0
  );
}

export async function rememberCustomGameAcknowledgement(
  s: ProductHarness,
  spaceId: string,
  choice: CustomGameChoice,
  afterSequence: number
): Promise<void> {
  for (let turn = 0; turn < 1000; turn += 1) {
    const returned = s.harness.roomNode
      .exportTopic(`space:${spaceId}`)
      ?.entries.findLast(
        (entry) =>
          entry.seq > afterSequence && CustomGamesChanged.is(entry.event)
      );
    if (returned !== undefined && CustomGamesChanged.is(returned.event)) {
      let rooms = acknowledged.get(s);
      if (rooms === undefined) {
        rooms = new Map();
        acknowledged.set(s, rooms);
      }
      rooms.set(spaceId, {
        commandId: returned.event.payload.commandId,
        choice,
      });
      return;
    }
    await s.session.advanceTime(0);
    await s.harness.drainServerFetch();
  }
  throw new Error('No Custom Game acknowledgement was returned');
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
