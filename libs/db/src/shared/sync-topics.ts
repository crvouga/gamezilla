import type { Topic } from '@pkgs/pubsub/interface';

/** Product channels context for Gamezilla sync pushes. */
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

/** Broadcast topic for the singleton client_config row. */
export function clientConfigTopic(): Topic {
  return 'system:client_config';
}

export function clientConfigChannels(): Topic[] {
  return [clientConfigTopic()];
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
