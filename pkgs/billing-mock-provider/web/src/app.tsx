/**
 * The mock provider's hosted pages as one SPA. The URL picks the page
 * (`…/checkout` or `…/portal`) and carries `accountId` + `returnUrl`, exactly
 * like a real provider's hosted session link.
 */
import {
  createEffect,
  createResource,
  type JSX,
  Match,
  Show,
  Switch,
} from 'solid-js';

import type { MockBillingState } from '../shared/mock-billing-contract';
import type { MockBillingApi } from './api';
import { CheckoutScreen } from './checkout-screen';
import { AlertIcon } from './icons';
import { PortalScreen } from './portal-screen';
import { BackLink, Button } from './ui';

export type MockBillingPage = 'checkout' | 'portal';

export type MockBillingAppProps = {
  readonly api: MockBillingApi;
  readonly page: MockBillingPage;
  readonly accountId: string | null;
  readonly returnUrl: string;
  readonly checkoutUrl: string;
  readonly navigate: (url: string) => void;
  readonly setTitle: (title: string) => void;
};

function Skeleton(): JSX.Element {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      class="mx-auto flex max-w-3xl animate-pulse flex-col gap-6 px-5 pt-10 sm:px-8"
    >
      <div class="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div class="h-8 w-64 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div class="h-44 rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/70" />
      <div class="h-36 rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/70" />
    </div>
  );
}

function Problem(props: {
  readonly title: string;
  readonly message: string;
  readonly returnUrl: string;
  readonly onRetry?: () => void;
}) {
  return (
    <div class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div class="animate-rise space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
        <span class="flex size-10 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
          <AlertIcon class="size-5" />
        </span>
        <div class="space-y-1">
          <h1 class="font-semibold text-lg">{props.title}</h1>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">
            {props.message}
          </p>
        </div>
        <div class="flex items-center justify-between gap-3">
          <Show when={props.returnUrl.length > 0}>
            <BackLink href={props.returnUrl} label="Return to app" />
          </Show>
          <Show when={props.onRetry}>
            {(retry) => <Button onClick={retry()}>Try again</Button>}
          </Show>
        </div>
      </div>
    </div>
  );
}

export function MockBillingApp(props: MockBillingAppProps) {
  const [state, { mutate, refetch }] = createResource(
    () => props.accountId,
    (accountId) => props.api.state(accountId)
  );
  const onState = (next: MockBillingState) => mutate(() => next);
  createEffect(() => {
    const name = state.latest?.product.name ?? 'Billing';
    props.setTitle(
      props.page === 'checkout' ? `Subscribe to ${name}` : `Manage ${name}`
    );
  });
  return (
    // The page's own root carries the base colours: the host may not be a
    // document body (a simulated browser renders it into a shadow root).
    <div class="min-h-dvh bg-zinc-50 font-sans text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
      <Switch fallback={<Skeleton />}>
        <Match when={props.accountId === null}>
          <Problem
            message="This billing link is missing its account. Go back to the app and open billing again."
            returnUrl={props.returnUrl}
            title="Link incomplete"
          />
        </Match>
        <Match when={state.error !== undefined && state.latest === undefined}>
          <Problem
            message={
              state.error instanceof Error
                ? state.error.message
                : 'The billing service did not respond.'
            }
            onRetry={() => void refetch()}
            returnUrl={props.returnUrl}
            title="Couldn't load billing"
          />
        </Match>
        <Match when={props.accountId !== null && state.latest}>
          {(loaded) => (
            <Show
              fallback={
                <CheckoutScreen
                  {...props}
                  accountId={props.accountId ?? ''}
                  onState={onState}
                  state={loaded()}
                />
              }
              when={props.page === 'portal'}
            >
              <PortalScreen
                {...props}
                accountId={props.accountId ?? ''}
                onState={onState}
                state={loaded()}
              />
            </Show>
          )}
        </Match>
      </Switch>
    </div>
  );
}
