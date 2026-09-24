/**
 * The test-card chooser: in test mode a person pays with one of the provider's
 * magic cards, each with a known outcome. Shared by checkout and the portal's
 * payment-method dialog.
 */
import type { MockTestPaymentMethod } from '@pkgs/billing-mock/wire';
import { For } from 'solid-js';

import { PAGE_TEST_CARDS, type PageTestCard } from '../../src/shared/pages';
import { MOCK_BILLING_TEST_IDS } from '../../src/shared/test-ids';
import { CardMark, CheckIcon } from './icons';

export const DEFAULT_TEST_CARD: MockTestPaymentMethod =
  PAGE_TEST_CARDS[0]?.paymentMethod ?? 'pm_card_visa';

function CardOption(props: {
  readonly name: string;
  readonly card: PageTestCard;
  readonly selected: boolean;
  readonly onSelect: (paymentMethod: MockTestPaymentMethod) => void;
}) {
  return (
    <label
      class="flex cursor-pointer items-center gap-3 rounded-xl p-3 ring-1 transition-all duration-150 has-focus-visible:outline-2 has-focus-visible:outline-indigo-600 has-focus-visible:outline-offset-2"
      classList={{
        'bg-indigo-50/60 ring-2 ring-indigo-600 dark:bg-indigo-500/10 dark:ring-indigo-400':
          props.selected,
        'bg-white ring-zinc-200 hover:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-700 dark:hover:ring-zinc-600':
          !props.selected,
      }}
      data-testid={MOCK_BILLING_TEST_IDS.checkoutCard(props.card.paymentMethod)}
    >
      <input
        checked={props.selected}
        class="sr-only"
        name={props.name}
        onChange={() => props.onSelect(props.card.paymentMethod)}
        type="radio"
        value={props.card.paymentMethod}
      />
      <CardMark brand={props.card.brand} />
      <span class="min-w-0 flex-1">
        <span class="block font-mono text-sm tracking-wide">
          {props.card.number}
        </span>
        <span class="block text-xs text-zinc-500 dark:text-zinc-400">
          {props.card.label} · {props.card.outcome}
        </span>
      </span>
      <span
        class="flex size-5 shrink-0 items-center justify-center rounded-full transition-colors"
        classList={{
          'bg-indigo-600 text-white dark:bg-indigo-400 dark:text-zinc-950':
            props.selected,
          'ring-1 ring-inset ring-zinc-300 dark:ring-zinc-600': !props.selected,
        }}
      >
        {props.selected ? <CheckIcon class="size-3" /> : null}
      </span>
    </label>
  );
}

export function CardChooser(props: {
  readonly name: string;
  readonly selected: MockTestPaymentMethod;
  readonly onSelect: (paymentMethod: MockTestPaymentMethod) => void;
}) {
  return (
    <fieldset class="space-y-2">
      <legend class="mb-1.5 block font-medium text-xs text-zinc-600 dark:text-zinc-400">
        Test card
      </legend>
      <For each={PAGE_TEST_CARDS}>
        {(card) => (
          <CardOption
            card={card}
            name={props.name}
            onSelect={props.onSelect}
            selected={props.selected === card.paymentMethod}
          />
        )}
      </For>
    </fieldset>
  );
}
