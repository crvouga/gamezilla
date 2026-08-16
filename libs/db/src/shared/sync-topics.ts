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

/** Broadcast topic for the singleton client_config row. */
export function clientConfigTopic(): Topic {
  return 'system:client_config';
}

export function clientConfigChannels(): Topic[] {
  return [clientConfigTopic()];
}

/** Broadcast topic for the shared chess puzzle catalog. */
export function chessPuzzlesTopic(): Topic {
  return 'system:chess_puzzles';
}

export function chessPuzzlesChannels(): Topic[] {
  return [chessPuzzlesTopic()];
}

export function userChannels(ctx: { readonly actorId: string }): Topic[] {
  return [userTopic(ctx.actorId)];
}
