import { createSignal } from 'solid-js';

/** A request has one answer in flight, shared by its Accept and Decline controls. */
export function useFriendRequestDecision() {
  const [pending, setPending] = createSignal(false);
  const run = async (operation: () => Promise<void>): Promise<void> => {
    if (pending())
      throw new Error('A friend request answer is already pending.');
    setPending(true);
    try {
      await operation();
    } finally {
      setPending(false);
    }
  };
  return { pending, run };
}
