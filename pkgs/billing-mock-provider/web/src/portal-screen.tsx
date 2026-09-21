/** The hosted portal: see the plan, switch interval, cancel or renew. */
import { createSignal, type JSX, Show } from 'solid-js';

import { MOCK_BILLING_TEST_IDS } from '../../../public/mock-test-ids';
import type {
  MockBillingMembership,
  MockBillingState,
  MockPortalAction,
} from '../shared/mock-billing-contract';
import type { MockBillingApi } from './api';
import { formatDate, isLive, perInterval } from './format';
import { CheckIcon, CloseIcon } from './icons';
import {
  CurrentPlanCard,
  IntervalCard,
  PaymentMethodCard,
  type PortalBusy,
  priceOf,
} from './portal-cards';
import { BackLink, Button, Card, Dialog, Notice, TestModePill } from './ui';

export type PortalScreenProps = {
  readonly state: MockBillingState;
  readonly accountId: string;
  readonly returnUrl: string;
  readonly checkoutUrl: string;
  readonly api: MockBillingApi;
  readonly onState: (state: MockBillingState) => void;
};

type Pending =
  | { readonly kind: 'cancel' }
  | { readonly kind: 'switch'; readonly priceKey: string }
  | null;

function busyKeyOf(action: MockPortalAction): PortalBusy {
  return action.kind === 'switch' ? `switch:${action.priceKey}` : action.kind;
}

function usePortal(props: PortalScreenProps) {
  const [pending, setPending] = createSignal<Pending>(null);
  const [busy, setBusy] = createSignal<PortalBusy>(null);
  const [flash, setFlash] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const run = async (action: MockPortalAction, success: string) => {
    setBusy(busyKeyOf(action));
    setError(null);
    setFlash(null);
    try {
      props.onState(
        await props.api.portal({ accountId: props.accountId, action })
      );
      setPending(null);
      setFlash(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };
  const close = () => {
    if (busy() !== null) return;
    setPending(null);
    setError(null);
  };
  return { pending, setPending, busy, flash, setFlash, error, run, close };
}

type Portal = ReturnType<typeof usePortal>;

function Flash(props: {
  readonly message: string;
  readonly onDismiss: () => void;
}) {
  return (
    <div
      aria-live="polite"
      data-testid={MOCK_BILLING_TEST_IDS.portalNotice}
      class="flex animate-pop items-center gap-3 rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-white dark:text-zinc-900"
      role="status"
    >
      <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <CheckIcon class="size-3" />
      </span>
      <span class="flex-1">{props.message}</span>
      <button
        aria-label="Dismiss"
        class="rounded-md p-1 opacity-70 hover:opacity-100"
        onClick={() => props.onDismiss()}
        type="button"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function CancelDialog(props: {
  readonly portal: Portal;
  readonly state: MockBillingState;
  readonly membership: MockBillingMembership;
}) {
  const ends = () =>
    props.membership.periodEndMs === null
      ? 'the end of your billing period'
      : formatDate(props.membership.periodEndMs);
  return (
    <Dialog
      footer={
        <>
          <Button onClick={props.portal.close} variant="secondary">
            Keep plan
          </Button>
          <Button
            busy={props.portal.busy() === 'cancel'}
            onClick={() =>
              void props.portal.run(
                { kind: 'cancel' },
                `Your plan was canceled. Access continues until ${ends()}.`
              )
            }
            testId={MOCK_BILLING_TEST_IDS.portalCancel}
            variant="danger"
          >
            Cancel plan
          </Button>
        </>
      }
      onClose={props.portal.close}
      open={props.portal.pending()?.kind === 'cancel'}
      title={`Cancel ${props.state.product.name}?`}
    >
      <p>
        You'll keep access until <strong>{ends()}</strong>, and you won't be
        charged again. You can renew any time before then.
      </p>
      <DialogError portal={props.portal} />
    </Dialog>
  );
}

function DialogError(props: { readonly portal: Portal }) {
  return (
    <Show when={props.portal.error()}>
      {(message) => (
        <div class="mt-4">
          <Notice tone="danger">{message()}</Notice>
        </div>
      )}
    </Show>
  );
}

function SwitchDialog(props: {
  readonly portal: Portal;
  readonly state: MockBillingState;
}) {
  const target = () => {
    const next = props.portal.pending();
    return next?.kind === 'switch'
      ? priceOf(props.state, next.priceKey)
      : undefined;
  };
  return (
    <Dialog
      footer={
        <>
          <Button onClick={props.portal.close} variant="secondary">
            Not now
          </Button>
          <Show when={target()}>
            {(price) => (
              <Button
                busy={props.portal.busy() === `switch:${price().key}`}
                onClick={() =>
                  void props.portal.run(
                    { kind: 'switch', priceKey: price().key },
                    `You're now on ${price().interval}ly billing.`
                  )
                }
                testId={MOCK_BILLING_TEST_IDS.portalSwitch(price().key)}
              >
                Switch to {price().interval}ly
              </Button>
            )}
          </Show>
        </>
      }
      onClose={props.portal.close}
      open={target() !== undefined}
      title="Change billing interval?"
    >
      <Show when={target()}>
        {(price) => (
          <p>
            Your new plan starts today at{' '}
            <strong>{perInterval(price())}</strong>. The test card on file is
            charged immediately and your plan renews every {price().interval}.
          </p>
        )}
      </Show>
      <DialogError portal={props.portal} />
    </Dialog>
  );
}

function NoPlan(props: {
  readonly state: MockBillingState;
  readonly checkoutUrl: string;
}) {
  const ended = () => props.state.membership?.periodEndMs ?? null;
  return (
    <Card>
      <div class="flex flex-col items-center gap-4 py-6 text-center">
        <h2 class="font-semibold text-lg">No active plan</h2>
        <p class="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          <Show fallback="You haven't subscribed yet." when={ended()}>
            {(ms) => <>Your plan ended on {formatDate(ms())}.</>}
          </Show>{' '}
          {props.state.product.description}
        </p>
        <a
          class="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 font-semibold text-sm text-white shadow-sm hover:bg-indigo-500"
          href={props.checkoutUrl}
        >
          Subscribe to {props.state.product.name}
        </a>
      </div>
    </Card>
  );
}

function PortalHeader(props: PortalScreenProps) {
  return (
    <header class="space-y-6">
      <div class="flex items-center justify-between gap-4">
        <BackLink
          href={props.returnUrl}
          label="Return to app"
          testId={MOCK_BILLING_TEST_IDS.portalReturn}
        />
        <TestModePill />
      </div>
      <div class="space-y-1">
        <p class="font-medium text-indigo-600 text-sm dark:text-indigo-400">
          {props.state.brand}
        </p>
        <h1 class="font-semibold text-3xl tracking-tight">
          Manage {props.state.product.name}
        </h1>
      </div>
    </header>
  );
}

function LivePlan(props: {
  readonly portal: Portal;
  readonly state: MockBillingState;
  readonly membership: MockBillingMembership;
}): JSX.Element {
  return (
    <>
      <CurrentPlanCard
        busy={props.portal.busy()}
        membership={props.membership}
        onCancel={() => props.portal.setPending({ kind: 'cancel' })}
        onResume={() =>
          void props.portal.run({ kind: 'resume' }, 'Your plan was renewed.')
        }
        state={props.state}
      />
      <IntervalCard
        disabled={props.portal.busy() !== null}
        membership={props.membership}
        onSwitch={(priceKey) =>
          props.portal.setPending({ kind: 'switch', priceKey })
        }
        state={props.state}
      />
      <PaymentMethodCard />
      <CancelDialog
        membership={props.membership}
        portal={props.portal}
        state={props.state}
      />
      <SwitchDialog portal={props.portal} state={props.state} />
    </>
  );
}

export function PortalScreen(props: PortalScreenProps) {
  const portal = usePortal(props);
  const live = () =>
    isLive(props.state.membership) ? props.state.membership : null;
  return (
    <div class="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-5 pt-6 pb-12 sm:px-8 sm:pt-10">
      <PortalHeader {...props} />
      <Show when={portal.flash()}>
        {(message) => (
          <Flash message={message()} onDismiss={() => portal.setFlash(null)} />
        )}
      </Show>
      <Show when={portal.error() !== null && portal.pending() === null}>
        <Notice tone="danger">{portal.error()}</Notice>
      </Show>
      <Show
        fallback={
          <NoPlan checkoutUrl={props.checkoutUrl} state={props.state} />
        }
        when={live()}
      >
        {(membership) => (
          <LivePlan
            membership={membership()}
            portal={portal}
            state={props.state}
          />
        )}
      </Show>
      <footer class="mt-auto pt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
        Mock Billing · test mode — no real charges are made.
      </footer>
    </div>
  );
}
