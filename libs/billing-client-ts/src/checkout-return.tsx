/** @jsxImportSource solid-js */
/**
 * When this person came back from paying at checkout. Checkout is a
 * full-page trip to the provider, so the paid return's mark in the address
 * is what starts it. The device keeps it for the signed-in account, so
 * leaving the billing screen, or closing the app, and coming back still says
 * the payment is being confirmed instead of offering a second checkout.
 */

import { useMyAccountId } from '@libs/auth-client-ts/use-current-user';
import { useClock } from '@pkgs/clock-client-ts/solid';
import { asKeyword } from '@pkgs/keyword-shared-ts/keyword';
import { createKvState } from '@pkgs/kv-root-client-ts/solid';
import { jsonKvCodec } from '@pkgs/kv-root-shared-ts/kv-state-codec';
import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  untrack,
  useContext,
} from 'solid-js';

export type CheckoutReturn = {
  /** When the paid return was seen (or last checked again), or `null`. */
  readonly returnedAtMs: Accessor<number | null>;
  /** The device's saved return has been read; until then none is known. */
  readonly ready: Accessor<boolean>;
  readonly mark: (atMs: number) => void;
  readonly clear: () => void;
};

/** A return older than this is no longer a payment being confirmed. */
export const CHECKOUT_RETURN_KEPT_MS = 24 * 60 * 60_000;

type StoredReturn = { readonly accountId: string; readonly atMs: number };

const NO_RETURN: StoredReturn = { accountId: '', atMs: 0 };

const STORED_RETURN_CODEC = jsonKvCodec<StoredReturn>(
  asKeyword('billing.checkout-return/value'),
  (value): value is StoredReturn =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StoredReturn).accountId === 'string' &&
    typeof (value as StoredReturn).atMs === 'number' &&
    Number.isFinite((value as StoredReturn).atMs)
);

/** The stored return when it belongs to `accountId` and is still recent. */
export function storedReturnFor(
  stored: StoredReturn,
  accountId: string | null,
  nowMs: number
): number | null {
  if (!accountId || stored.accountId !== accountId) return null;
  if (nowMs - stored.atMs > CHECKOUT_RETURN_KEPT_MS) return null;
  return stored.atMs;
}

function createCheckoutReturn(): CheckoutReturn {
  const accountId = useMyAccountId();
  const [ready, setReady] = createSignal(false);
  const [stored, setStored] = createKvState<StoredReturn>({
    key: asKeyword('billing.checkout-return/last'),
    default: NO_RETURN,
    codec: STORED_RETURN_CODEC,
    onHydrated: () => setReady(true),
  });
  const clock = useClock();
  // Recency is judged when the mark is read back, not ticked afterwards.
  const returnedAtMs = createMemo(() =>
    storedReturnFor(stored(), accountId(), clock.now())
  );
  return {
    returnedAtMs,
    ready,
    mark: (atMs) => {
      const id = untrack(accountId);
      if (id) setStored({ accountId: id, atMs });
    },
    clear: () => setStored(NO_RETURN),
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
