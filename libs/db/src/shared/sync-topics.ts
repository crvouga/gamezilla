import type { Topic } from '@pkgs/pubsub/interface';

/** Product channels context for Gamezilla sync nudges. */
export type AppChannelsCtx = {
  readonly actorId: string;
  readonly membershipSpaceIds: readonly string[];
};

export function userTopic(actorId: string): Topic {
  return `user:${actorId}`;
}

export function roomTopic(spaceId: string): Topic {
  return `room:${spaceId}`;
}

export function userChannels(ctx: { readonly actorId: string }): Topic[] {
  return [userTopic(ctx.actorId)];
}

export function spaceListChannels(ctx: {
  readonly actorId: string;
  readonly membershipSpaceIds?: readonly string[];
}): Topic[] {
  const memberships = ctx.membershipSpaceIds ?? [];
  return [userTopic(ctx.actorId), ...memberships.map((id) => roomTopic(id))];
}
