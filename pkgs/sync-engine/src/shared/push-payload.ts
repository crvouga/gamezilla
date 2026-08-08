import type { PushMessage } from '../protocol/v1';

export type { PushMessage };

/** Framework channels context — identity only; product packages may pass a wider object. */
export type QueryChannelsCtx = {
  readonly actorId: string;
  /** Live space ids for room topic subscribe + fanout trust gates. */
  readonly membershipSpaceIds?: readonly string[];
};
