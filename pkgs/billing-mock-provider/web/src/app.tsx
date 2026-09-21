/**
 * The provider's hosted pages as one SPA. The URL picks the page and carries
 * the session, exactly like a real provider's hosted link:
 * `/c/pay/<checkout session>` or `/p/session/<portal session>`.
 */
import {
  createEffect,
  createResource,
  type JSX,
  Match,
  Show,
  Switch,
} from 'solid-js';

import { MOCK_BILLING_BRAND } from '../../src/shared/brand';
import type { CheckoutView, PortalView } from '../../src/shared/pages';
import { isDeadLink, type MockBillingPageApi, messageOf } from './api';
import { CheckoutScreen } from './checkout-screen';
import { AlertIcon } from './icons';
import { PortalScreen } from './portal-screen';
import { BackLink, Button } from './ui';

export type MockBillingPage =
  | { readonly kind: 'checkout'; readonly sessionId: string }
  | { readonly kind: 'portal'; readonly sessionId: string }
  | { readonly kind: 'unknown' };

/** Which hosted page a URL is. */
export function pageOf(url: URL): MockBillingPage {
  const checkout = /^\/c\/pay\/([^/]+)$/.exec(url.pathname);
  if (checkout?.[1] !== undefined) {
    return { kind: 'checkout', sessionId: decodeURIComponent(checkout[1]) };
  }
  const portal = /^\/p\/session\/([^/]+)$/.exec(url.pathname);
  if (portal?.[1] !== undefined) {
    return { kind: 'portal', sessionId: decodeURIComponent(portal[1]) };
  }
  return { kind: 'unknown' };
}

export type MockBillingAppProps = {
  readonly api: MockBillingPageApi;
  readonly page: MockBillingPage;
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
  readonly returnUrl?: string;
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
          <Show when={props.returnUrl}>
            {(href) => <BackLink href={href()} label="Return to app" />}
          </Show>
          <Show when={props.onRetry}>
            {(retry) => <Button onClick={retry()}>Try again</Button>}
          </Show>
        </div>
      </div>
      <p class="text-center text-xs text-zinc-500 dark:text-zinc-400">
        {MOCK_BILLING_BRAND.footer}
      </p>
    </div>
  );
}

function LoadProblem(props: {
  readonly error: unknown;
  readonly onRetry: () => void;
}) {
  return (
    <Show
      fallback={
        <Problem
          message={messageOf(
            props.error,
            'The billing service did not respond.'
          )}
          onRetry={props.onRetry}
          title="Couldn't load billing"
        />
      }
      when={isDeadLink(props.error)}
    >
      <Problem
        message="This link has expired or is invalid. Go back to the app and open billing again."
        title="Link expired"
      />
    </Show>
  );
}

function CheckoutPage(props: MockBillingAppProps & { readonly id: string }) {
  const [view, { refetch }] = createResource(
    () => props.id,
    (id) => props.api.checkout(id)
  );
  createEffect(() => {
    // `latest` rethrows a load error; the title falls back instead.
    const name =
      (view.state === 'ready' || view.state === 'refreshing'
        ? view.latest.business.product.name
        : null) ?? 'Billing';
    props.setTitle(`Subscribe to ${name} · ${MOCK_BILLING_BRAND.name}`);
  });
  return (
    <Switch fallback={<Skeleton />}>
      <Match when={view.state === 'errored'}>
        <LoadProblem error={view.error} onRetry={() => void refetch()} />
      </Match>
      <Match when={view.latest?.session.status === 'expired'}>
        <Problem
          message="This checkout session has expired. Go back to the app and start again."
          returnUrl={view.latest?.session.cancelUrl ?? ''}
          title="Checkout expired"
        />
      </Match>
      <Match when={view.latest}>
        {(loaded: () => CheckoutView) => (
          <CheckoutScreen
            api={props.api}
            navigate={props.navigate}
            view={loaded()}
          />
        )}
      </Match>
    </Switch>
  );
}

function PortalPage(props: MockBillingAppProps & { readonly id: string }) {
  const [view, { mutate, refetch }] = createResource(
    () => props.id,
    (id) => props.api.portal(id)
  );
  createEffect(() => {
    // `latest` rethrows a load error; the title falls back instead.
    const name =
      (view.state === 'ready' || view.state === 'refreshing'
        ? view.latest.business.product.name
        : null) ?? 'Billing';
    props.setTitle(`Manage ${name} · ${MOCK_BILLING_BRAND.name}`);
  });
  return (
    <Switch fallback={<Skeleton />}>
      <Match when={view.state === 'errored'}>
        <LoadProblem error={view.error} onRetry={() => void refetch()} />
      </Match>
      <Match when={view.latest}>
        {(loaded: () => PortalView) => (
          <PortalScreen
            api={props.api}
            onView={(next) => mutate(() => next)}
            sessionId={props.id}
            view={loaded()}
          />
        )}
      </Match>
    </Switch>
  );
}

export function MockBillingApp(props: MockBillingAppProps) {
  return (
    // The page's own root carries the base colours: the host may not be a
    // document body (a simulated browser renders it into a shadow root).
    <div class="min-h-dvh bg-zinc-50 font-sans text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
      <Switch
        fallback={
          <Problem
            message="This isn't a billing page. Go back to the app and open billing again."
            title="Page not found"
          />
        }
      >
        <Match when={props.page.kind === 'checkout' ? props.page : undefined}>
          {(page) => <CheckoutPage {...props} id={page().sessionId} />}
        </Match>
        <Match when={props.page.kind === 'portal' ? props.page : undefined}>
          {(page) => <PortalPage {...props} id={page().sessionId} />}
        </Match>
      </Switch>
    </div>
  );
}
