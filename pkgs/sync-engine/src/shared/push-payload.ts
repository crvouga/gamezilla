import type { PushMessage } from '../protocol';

export type { PushMessage };

/** Framework channels context — identity only; room topics come from held rows. */
export type QueryChannelsCtx = {
  readonly actorId: string;
};
