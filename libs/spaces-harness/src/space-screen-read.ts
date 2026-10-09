import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront, visible } from '@libs/harness/observations';
import { Handles } from '@libs/test-ids-shared/handles';

export type SpaceScreen =
  | 'ended'
  | 'viewingPresence'
  | 'space'
  | 'lobby'
  | 'left'
  | 'droppedOut'
  | 'elsewhere';

/** The space or lobby a person can currently see. */
export async function spaceScreenOf(
  s: ProductHarness,
  actorId: string
): Promise<SpaceScreen> {
  await bringToFront(s, actorId);
  if (await visible(s, actorId, [Handles.spaceEnded])) return 'ended';
  if (await visible(s, actorId, [Handles.spaceJoinPrompt])) return 'left';
  if (
    (await visible(s, actorId, [Handles.spaceHostOffline])) ||
    (await visible(s, actorId, [Handles.spacesNeedConnection]))
  )
    return 'droppedOut';
  if (await visible(s, actorId, [Handles.spaceMembersClose]))
    return 'viewingPresence';
  if (await visible(s, actorId, [Handles.spaceClose])) return 'space';
  if (await visible(s, actorId, [Handles.spaceCreate])) return 'lobby';
  if (await visible(s, actorId, [Handles.spaceJoin])) return 'left';
  return 'elsewhere';
}

/** Context for an automated presence failure, without changing room state. */
export async function spacePresenceDiagnostics(
  s: ProductHarness
): Promise<string> {
  const routes = await Promise.all(
    [...s.actors.values()].map(async (actor) => ({
      actor: actor.id,
      path: await actor.currentPath(),
    }))
  );
  const rooms = s.harness.roomNode.listTopics().map((topic) => ({
    topic,
    room: s.harness.roomNode.inspect(topic),
  }));
  return JSON.stringify({ routes, rooms });
}
