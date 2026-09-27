/** The portal's interaction state: which dialog is open, what is in flight. */
import { createSignal } from 'solid-js';

import type {
  PagePrice,
  PortalAction,
  PortalView,
} from '../../src/shared/pages';
import { type MockBillingPageApi, messageOf } from './api';
import type { PortalBusy } from './portal-cards';

export type PortalPending =
  | { readonly kind: 'cancel' }
  | { readonly kind: 'switch'; readonly price: PagePrice }
  | { readonly kind: 'payment' }
  | null;

function busyKeyOf(action: PortalAction): PortalBusy {
  if (action.kind === 'switch') return `switch:${action.price}`;
  if (action.kind === 'update_payment_method') return 'payment';
  return action.kind;
}

export function usePortal(props: {
  readonly sessionId: string;
  readonly api: MockBillingPageApi;
  readonly onView: (view: PortalView) => void;
}) {
  const [pending, setPending] = createSignal<PortalPending>(null);
  const [busy, setBusy] = createSignal<PortalBusy>(null);
  const [flash, setFlash] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const run = async (action: PortalAction, success: string) => {
    setBusy(busyKeyOf(action));
    setError(null);
    setFlash(null);
    try {
      props.onView(await props.api.portalAction(props.sessionId, action));
      setPending(null);
      setFlash(success);
    } catch (cause) {
      setError(messageOf(cause, 'Something went wrong'));
    } finally {
      setBusy(null);
    }
  };
  const open = (next: PortalPending) => {
    setError(null);
    setPending(next);
  };
  const close = () => {
    if (busy() !== null) return;
    setPending(null);
    setError(null);
  };
  return { pending, open, busy, flash, setFlash, error, run, close };
}

export type Portal = ReturnType<typeof usePortal>;
