/** @jsxImportSource solid-js */
/**
 * When this person came back from paying at checkout, kept for the signed-in
 * session so leaving the billing screen and coming back still says the
 * payment is being confirmed. Checkout is a full-page trip to the provider,
 * so the paid return's mark in the address is what starts it.
 */

import {
  type Accessor,
  createContext,
  createSignal,
  type JSX,
  useContext,
} from 'solid-js';

export type CheckoutReturn = {
  /** When the paid return was seen (or last checked again), or `null`. */
  readonly returnedAtMs: Accessor<number | null>;
  readonly mark: (atMs: number) => void;
  readonly clear: () => void;
};

function createCheckoutReturn(): CheckoutReturn {
  const [returnedAtMs, setReturnedAtMs] = createSignal<number | null>(null);
  return {
    returnedAtMs,
    mark: (atMs) => setReturnedAtMs(atMs),
    clear: () => setReturnedAtMs(null),
  };
}

const CheckoutReturnContext = createContext<CheckoutReturn>();

/** Billing's session provider: one checkout return per signed-in session. */
export function CheckoutReturnProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <CheckoutReturnContext.Provider value={createCheckoutReturn()}>
      {props.children}
    </CheckoutReturnContext.Provider>
  );
}

/** The session's checkout return; a screen of its own outside the provider. */
export function useCheckoutReturn(): CheckoutReturn {
  return useContext(CheckoutReturnContext) ?? createCheckoutReturn();
}
