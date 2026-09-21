/** The billing-interval chooser shared by checkout and the portal. */
import { For, type JSX, Show } from 'solid-js';

import type { PagePrice } from '../../src/shared/pages';
import { MOCK_BILLING_TEST_IDS } from '../../src/shared/test-ids';
import {
  formatMoney,
  intervalLabel,
  monthlyEquivalent,
  priceKeyOf,
  savingsPercent,
} from './format';
import { CheckIcon } from './icons';

export type PlanOptionsProps = {
  readonly name: string;
  readonly prices: readonly PagePrice[];
  readonly selectedId: string;
  readonly onSelect: (priceId: string) => void;
  /** Extra content under an option (e.g. the portal's "Current plan"). */
  readonly footer?: (price: PagePrice) => JSX.Element;
};

export function SavingsTag(props: {
  readonly price: PagePrice;
  readonly prices: readonly PagePrice[];
}) {
  const percent = () => savingsPercent(props.price, props.prices);
  return (
    <Show when={percent() > 0}>
      <span class="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-[11px] text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300">
        Save {percent()}%
      </span>
    </Show>
  );
}

function PlanOption(props: PlanOptionsProps & { readonly price: PagePrice }) {
  const selected = () => props.selectedId === props.price.id;
  return (
    <label
      data-testid={MOCK_BILLING_TEST_IDS.checkoutPlan(priceKeyOf(props.price))}
      class="group relative flex cursor-pointer flex-col gap-1 rounded-xl p-4 ring-1 transition-all duration-150 has-focus-visible:outline-2 has-focus-visible:outline-indigo-600 has-focus-visible:outline-offset-2"
      classList={{
        'bg-indigo-50/60 ring-2 ring-indigo-600 dark:bg-indigo-500/10 dark:ring-indigo-400':
          selected(),
        'bg-white ring-zinc-200 hover:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-700 dark:hover:ring-zinc-600':
          !selected(),
      }}
    >
      <input
        checked={selected()}
        class="sr-only"
        name={props.name}
        onChange={() => props.onSelect(props.price.id)}
        type="radio"
        value={props.price.id}
      />
      <span class="flex items-center justify-between gap-2">
        <span class="font-semibold text-sm">{intervalLabel(props.price)}</span>
        <span
          class="flex size-5 items-center justify-center rounded-full transition-colors"
          classList={{
            'bg-indigo-600 text-white dark:bg-indigo-400 dark:text-zinc-950':
              selected(),
            'ring-1 ring-inset ring-zinc-300 dark:ring-zinc-600': !selected(),
          }}
        >
          <Show when={selected()}>
            <CheckIcon class="size-3" />
          </Show>
        </span>
      </span>
      <span class="flex items-baseline gap-1">
        <span class="font-semibold text-2xl tracking-tight">
          {formatMoney(props.price.unitAmount, props.price.currency)}
        </span>
        <span class="text-sm text-zinc-500 dark:text-zinc-400">
          / {props.price.interval}
        </span>
      </span>
      <span class="flex min-h-5 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <Show when={monthlyEquivalent(props.price)} fallback="Billed monthly">
          {(perMonth) => <span>{perMonth()}</span>}
        </Show>
        <SavingsTag price={props.price} prices={props.prices} />
      </span>
      <Show when={props.footer}>
        {(footer) => <span class="mt-2">{footer()(props.price)}</span>}
      </Show>
    </label>
  );
}

export function PlanOptions(props: PlanOptionsProps) {
  return (
    <fieldset class="grid gap-3 sm:grid-cols-2">
      <legend class="sr-only">Billing interval</legend>
      <For each={props.prices}>
        {(price) => <PlanOption {...props} price={price} />}
      </For>
    </fieldset>
  );
}
