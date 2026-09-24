/**
 * The hosted pages' client for the provider's page API. `fetch` is injected by
 * the entry (the browser's, or a simulated browser's); paths resolve against
 * the page's own origin, so the pages work wherever the provider runs.
 */
import type { MockErrorBody } from '@pkgs/billing-mock/wire';

import {
  type CheckoutConfirmBody,
  type CheckoutConfirmResult,
  type CheckoutView,
  MOCK_BILLING_PAGE_API,
  type PortalAction,
  type PortalView,
} from '../../src/shared/pages';

export type PageFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** A non-2xx page API answer; `status` tells an expired link from an outage. */
export class PageApiError extends Error {
  constructor(
    readonly status: number,
    readonly type: string | null,
    message: string
  ) {
    super(message);
    this.name = 'PageApiError';
  }
}

export type MockBillingPageApi = {
  readonly checkout: (id: string) => Promise<CheckoutView>;
  readonly confirmCheckout: (
    id: string,
    body: CheckoutConfirmBody
  ) => Promise<CheckoutConfirmResult>;
  readonly portal: (id: string) => Promise<PortalView>;
  readonly portalAction: (
    id: string,
    action: PortalAction
  ) => Promise<PortalView>;
};

async function read<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (response.ok) return payload as T;
  const error = (payload as MockErrorBody | null)?.error;
  throw new PageApiError(
    response.status,
    error?.type ?? null,
    typeof error?.message === 'string'
      ? error.message
      : `Request failed (${String(response.status)})`
  );
}

export function createPageApi(args: {
  readonly fetch: PageFetch;
  readonly origin: string;
}): MockBillingPageApi {
  const url = (path: string) => new URL(path, args.origin).toString();
  const get = async <T>(path: string) =>
    await read<T>(await args.fetch(url(path)));
  const post = async <T>(path: string, body: unknown) =>
    await read<T>(
      await args.fetch(url(path), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    );
  return {
    checkout: (id) => get(MOCK_BILLING_PAGE_API.checkout(id)),
    confirmCheckout: (id, body) =>
      post(MOCK_BILLING_PAGE_API.checkoutConfirm(id), body),
    portal: (id) => get(MOCK_BILLING_PAGE_API.portal(id)),
    portalAction: (id, action) =>
      post(MOCK_BILLING_PAGE_API.portalAction(id), action),
  };
}

/** Whether a load failed because the link itself is dead (no retry helps). */
export function isDeadLink(error: unknown): boolean {
  return (
    error instanceof PageApiError &&
    (error.status === 404 || error.status === 410)
  );
}

export function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : fallback;
}
