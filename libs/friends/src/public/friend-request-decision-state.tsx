/** @jsxImportSource solid-js */
import { createContext, createSignal, type JSX, useContext } from 'solid-js';

/**
 * Which friend-request decision modal is open (by notification id), held
 * above the virtualized notification rows. Row content remounts whenever its
 * data object identity changes (read-state flips, sync merges) — modal open
 * state kept in the row would die with it, closing the modal from under the
 * user right after they open it.
 */
export type FriendRequestDecision = {
  readonly openId: () => string | null;
  readonly open: (interactionId: string) => void;
  readonly close: () => void;
};

const FriendRequestDecisionContext =
  createContext<FriendRequestDecision | null>(null);

export function FriendRequestDecisionProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const [openId, setOpenId] = createSignal<string | null>(null);
  const value: FriendRequestDecision = {
    openId,
    open: (interactionId: string) => setOpenId(interactionId),
    close: () => setOpenId(null),
  };
  return (
    <FriendRequestDecisionContext.Provider value={value}>
      {props.children}
    </FriendRequestDecisionContext.Provider>
  );
}

/** Null outside a provider (hosts that render cards standalone). */
export function useFriendRequestDecisionOptional(): FriendRequestDecision | null {
  return useContext(FriendRequestDecisionContext);
}
