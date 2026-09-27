/** The portal's billing cards: payment method and invoice history. */
import type { MockCard } from '@pkgs/billing-mock/wire';
import { For, type JSX, Show } from 'solid-js';

import type { PortalView } from '../../src/shared/pages';
import { MOCK_BILLING_TEST_IDS } from '../../src/shared/test-ids';
import {
  formatMoney,
  formatShortDate,
  humanize,
  INVOICE_STATUS_META,
} from './format';
import { CardMark } from './icons';
import { Badge, Button, Card } from './ui';

function CardDetails(props: { readonly card: MockCard }) {
  return (
    <>
      <CardMark brand={props.card.brand} />
      <div class="min-w-0 flex-1">
        <p class="font-medium text-sm">
          {humanize(props.card.brand)} ending in {props.card.last4}
        </p>
        <p class="text-sm text-zinc-500 dark:text-zinc-400">
          Expires {String(props.card.exp_month).padStart(2, '0')}/
          {props.card.exp_year}
        </p>
      </div>
    </>
  );
}

export function PaymentMethodCard(props: {
  readonly card: MockCard | null;
  readonly disabled: boolean;
  readonly onUpdate: () => void;
}): JSX.Element {
  return (
    <Card title="Payment method">
      <div class="flex items-center gap-4">
        <Show
          fallback={
            <p class="min-w-0 flex-1 text-sm text-zinc-500 dark:text-zinc-400">
              No payment method on file.
            </p>
          }
          when={props.card}
        >
          {(card) => <CardDetails card={card()} />}
        </Show>
        <Button
          disabled={props.disabled}
          onClick={props.onUpdate}
          testId={MOCK_BILLING_TEST_IDS.portalPaymentMethodStart}
          variant="secondary"
        >
          {props.card === null ? 'Add' : 'Update'}
        </Button>
      </div>
    </Card>
  );
}

export function InvoiceHistoryCard(props: {
  readonly view: PortalView;
}): JSX.Element {
  return (
    <Card testId={MOCK_BILLING_TEST_IDS.portalInvoices} title="Invoice history">
      <Show
        fallback={
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            No invoices yet.
          </p>
        }
        when={props.view.invoices.length > 0}
      >
        <ul class="-my-3 divide-y divide-zinc-100 dark:divide-zinc-800">
          <For each={props.view.invoices}>
            {(invoice) => (
              <li class="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                <span class="w-28 shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
                  {formatShortDate(invoice.createdMs)}
                </span>
                <span class="min-w-0 flex-1 truncate">
                  {invoice.description}
                </span>
                <span class="tabular-nums">
                  {formatMoney(invoice.amountDue, invoice.currency)}
                </span>
                <Badge tone={INVOICE_STATUS_META[invoice.status].tone}>
                  {INVOICE_STATUS_META[invoice.status].label}
                </Badge>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </Card>
  );
}
