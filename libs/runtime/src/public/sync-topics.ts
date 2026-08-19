import type { Topic } from '@pkgs/pubsub/interface';

/** Product channels context for Gamezilla sync pushes. */
export type AppChannelsCtx = {
  readonly actorId: string;
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
