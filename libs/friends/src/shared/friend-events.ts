export type FriendEvent =
  | {
      readonly type: 'friend.request.sent';
      readonly requestId: string;
      readonly fromUserId: string;
      readonly toUserId: string;
    }
  | {
      readonly type: 'friend.request.accepted';
      readonly requestId: string;
      readonly userLow: string;
      readonly userHigh: string;
    }
  | {
      readonly type: 'friend.removed';
      readonly userLow: string;
      readonly userHigh: string;
    }
  | {
      readonly type: 'friend.blocked';
      readonly blockerId: string;
      readonly blockedId: string;
    };

export type FriendEventListener = (event: FriendEvent) => void;

const listeners = new Set<FriendEventListener>();

export function subscribeFriendEvents(
  listener: FriendEventListener
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishFriendEvent(event: FriendEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}
