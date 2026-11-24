import { createSignal } from 'solid-js';

/** A request has one answer in flight, shared by its Accept and Decline controls. */
export function useFriendRequestDecision() {
  const [pending, setPending] = createSignal(false);
  // The guard itself: `pending` shows the answer in flight only once the
  // screen has caught up, and a second answer can arrive before that.
  let inFlight = false;
  const run = async (operation: () => Promise<void>): Promise<void> => {
    if (inFlight)
      throw new Error('A friend request answer is already pending.');
    inFlight = true;
    setPending(true);
    try {
      await operation();
    } finally {
      inFlight = false;
      setPending(false);
    }
  };
  return { pending, run };
}
