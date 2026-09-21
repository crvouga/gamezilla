/** The portal's confirmations: cancel, switch interval, update payment method. */
import type { MockTestPaymentMethod } from '@pkgs/billing-mock/wire';
import { createSignal, For, Show } from 'solid-js';

import type { PortalSubscription, PortalView } from '../../src/shared/pages';
import { MOCK_BILLING_TEST_IDS } from '../../src/shared/test-ids';
import { CardChooser, DEFAULT_TEST_CARD } from './card-chooser';
import { formatDate, humanize, perInterval, priceKeyOf } from './format';
import type { Portal } from './portal-state';
import { Button, Dialog, Notice } from './ui';

function DialogError(props: { readonly portal: Portal }) {
  return (
    <Show when={props.portal.error()}>
      {(message) => (
        <div class="mt-4">
          <Notice testId={MOCK_BILLING_TEST_IDS.portalError} tone="danger">
            {message()}
          </Notice>
        </div>
      )}
    </Show>
  );
}

function ReasonOption(props: {
  readonly reason: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <label
      class="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 ring-1 ring-inset"
      classList={{
        'bg-indigo-50/60 ring-indigo-600 dark:bg-indigo-500/10 dark:ring-indigo-400':
          props.selected,
        'ring-zinc-200 hover:bg-zinc-50 dark:ring-zinc-700 dark:hover:bg-zinc-800':
          !props.selected,
      }}
      data-testid={MOCK_BILLING_TEST_IDS.portalCancelReason(props.reason)}
    >
      <input
        checked={props.selected}
        class="accent-indigo-600"
        name="cancel-reason"
        onChange={() => props.onSelect()}
        type="radio"
        value={props.reason}
      />
      <span class="text-zinc-800 dark:text-zinc-200">
        {humanize(props.reason)}
      </span>
    </label>
  );
}

export function CancelDialog(props: {
  readonly portal: Portal;
  readonly view: PortalView;
  readonly subscription: PortalSubscription;
}) {
  const [reason, setReason] = createSignal<string | null>(null);
  const ends = () => formatDate(props.subscription.currentPeriodEndMs);
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
                { kind: 'cancel', reason: reason() },
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
      title={`Cancel ${props.view.business.product.name}?`}
    >
      <p>
        You'll keep access until <strong>{ends()}</strong>, and you won't be
        charged again. You can renew any time before then.
      </p>
      <Show when={props.view.cancellationReasons.length > 0}>
        <fieldset class="mt-4 space-y-2">
          <legend class="mb-2 font-medium text-xs text-zinc-500 dark:text-zinc-400">
            Why are you canceling? (optional)
          </legend>
          <For each={props.view.cancellationReasons}>
            {(option) => (
              <ReasonOption
                onSelect={() => setReason(option)}
                reason={option}
                selected={reason() === option}
              />
            )}
          </For>
        </fieldset>
      </Show>
      <DialogError portal={props.portal} />
    </Dialog>
  );
}

function SwitchCopy(props: {
  readonly subscription: PortalSubscription;
  readonly perInterval: string;
}) {
  return (
    <Show
      fallback={
        <p>
          Your new plan starts today at <strong>{props.perInterval}</strong>.
          We'll charge the card on file now, minus credit for unused time.
        </p>
      }
      when={props.subscription.status === 'trialing'}
    >
      <p>
        Your free trial continues until{' '}
        <strong>
          {formatDate(
            props.subscription.trialEndMs ??
              props.subscription.currentPeriodEndMs
          )}
        </strong>
        . After that you'll be charged <strong>{props.perInterval}</strong>.
      </p>
    </Show>
  );
}

export function SwitchDialog(props: {
  readonly portal: Portal;
  readonly subscription: PortalSubscription;
}) {
  const target = () => {
    const next = props.portal.pending();
    return next?.kind === 'switch' ? next.price : undefined;
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
                busy={props.portal.busy() === `switch:${price().id}`}
                onClick={() =>
                  void props.portal.run(
                    { kind: 'switch', price: price().id },
                    `You're now on ${price().interval}ly billing.`
                  )
                }
                testId={MOCK_BILLING_TEST_IDS.portalSwitch(priceKeyOf(price()))}
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
          <SwitchCopy
            perInterval={perInterval(price())}
            subscription={props.subscription}
          />
        )}
      </Show>
      <DialogError portal={props.portal} />
    </Dialog>
  );
}

export function PaymentMethodDialog(props: {
  readonly portal: Portal;
  readonly hasOpenInvoice: boolean;
}) {
  const [card, setCard] =
    createSignal<MockTestPaymentMethod>(DEFAULT_TEST_CARD);
  return (
    <Dialog
      footer={
        <>
          <Button onClick={props.portal.close} variant="secondary">
            Cancel
          </Button>
          <Button
            busy={props.portal.busy() === 'payment'}
            onClick={() =>
              void props.portal.run(
                { kind: 'update_payment_method', paymentMethod: card() },
                props.hasOpenInvoice
                  ? 'Your payment method was updated and your invoice was paid.'
                  : 'Your payment method was updated.'
              )
            }
            testId={MOCK_BILLING_TEST_IDS.portalPaymentMethod}
          >
            {props.hasOpenInvoice ? 'Update and pay' : 'Update'}
          </Button>
        </>
      }
      onClose={props.portal.close}
      open={props.portal.pending()?.kind === 'payment'}
      title="Update payment method"
    >
      <p class="mb-4">
        The card becomes your default for future payments
        <Show when={props.hasOpenInvoice}>
          , and pays the open invoice right away
        </Show>
        .
      </p>
      <CardChooser name="portal-card" onSelect={setCard} selected={card()} />
      <DialogError portal={props.portal} />
    </Dialog>
  );
}
