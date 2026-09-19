/**
 * The SPA's client for the mock provider's JSON API. `fetch` is injected by
 * the browser entry; the base is the page's own directory
 * (`…/api/billing/mock/`), so the pages work wherever the API is mounted.
 */
import {
  MOCK_BILLING_API,
  type MockBillingState,
  type MockCheckoutBody,
  type MockPortalBody,
} from '../shared/mock-billing-contract';

export type MockBillingApi = {
  readonly state: (accountId: string) => Promise<MockBillingState>;
  readonly checkout: (body: MockCheckoutBody) => Promise<MockBillingState>;
  readonly portal: (body: MockPortalBody) => Promise<MockBillingState>;
};

async function readState(response: Response): Promise<MockBillingState> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null
        ? Reflect.get(payload, 'error')
        : null;
    throw new Error(
      typeof message === 'string'
        ? message
        : `Request failed (${String(response.status)})`
    );
  }
  return payload as MockBillingState;
}

export function createMockBillingApi(args: {
  readonly fetch: (url: string, init?: RequestInit) => Promise<Response>;
  readonly baseUrl: string;
}): MockBillingApi {
  const url = (path: string) => new URL(path, args.baseUrl).toString();
  const post = async (path: string, body: unknown) =>
    await readState(
      await args.fetch(url(path), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    );
  return {
    state: async (accountId) => {
      const target = new URL(MOCK_BILLING_API.state, args.baseUrl);
      target.searchParams.set('accountId', accountId);
      return await readState(await args.fetch(target.toString()));
    },
    checkout: async (body) => await post(MOCK_BILLING_API.checkout, body),
    portal: async (body) => await post(MOCK_BILLING_API.portal, body),
  };
}
