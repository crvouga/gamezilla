import type { Topic } from '@pkgs/pubsub/interface';

/** Shared topic so all notes-app sim clients receive the same push stream. */
export const NOTES_WORLD_TOPIC = 'user:notes-world' as Topic;

export function userTopic(actorId: string): Topic {
  return `user:${actorId}` as Topic;
}

export function roomTopic(spaceId: string): Topic {
  return `room:${spaceId}` as Topic;
}

/** Product-shaped channels: user inbox + live room memberships. */
export function spaceMembershipChannels(ctx: {
  readonly actorId: string;
  readonly membershipSpaceIds?: readonly string[];
}): Topic[] {
  const memberships = ctx.membershipSpaceIds ?? [];
  return [userTopic(ctx.actorId), ...memberships.map((id) => roomTopic(id))];
}
