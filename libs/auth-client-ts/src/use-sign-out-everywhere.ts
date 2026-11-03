import { type Accessor, createSignal } from 'solid-js';
import { useAuthClientPort } from './auth-client-provider';
import { useSignOutIntent } from './sign-out-intent';

export type SignOutEverywhere = {
  readonly confirming: Accessor<boolean>;
  readonly open: () => void;
  readonly close: () => void;
  readonly confirm: () => Promise<void>;
};

/** The sign-out-everywhere confirmation and the port call behind it. */
export function useSignOutEverywhere(): SignOutEverywhere {
  const port = useAuthClientPort();
  const intent = useSignOutIntent();
  const [confirming, setConfirming] = createSignal(false);
  return {
    confirming,
    open: () => setConfirming(true),
    close: () => setConfirming(false),
    // This device asked: its own sign-out is no news to the person here.
    confirm: async () => {
      intent.expect();
      try {
        await port.signOutEverywhere();
      } catch (error) {
        intent.cancel();
        throw error;
      }
    },
  };
}
