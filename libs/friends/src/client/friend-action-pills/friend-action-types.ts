import type { ReactNode } from 'react';

import type { FriendshipStatus } from '../../shared/friends-types';

export type FriendActionPillsProps = {
  readonly userId: string;
  readonly status: FriendshipStatus;
  readonly incomingRequestId: string | null;
  readonly outgoingRequestId: string | null;
  readonly onChanged?: (() => void) | undefined;
};

/** Bound mutation callbacks for status-driven pill rendering (not a write hub). */
export type FriendActionMutations = {
  readonly addFriend: () => Promise<void>;
  readonly confirmRequest: () => Promise<void>;
  readonly deleteRequest: () => Promise<void>;
  readonly cancelRequest: () => Promise<void>;
  readonly unblock: () => Promise<void>;
};

export type FriendActionPillsComponent = (
  props: FriendActionPillsProps
) => ReactNode;
