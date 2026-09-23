import type { Billing } from '@pkgs/billing';
import type { HttpClient } from '@pkgs/http-client';

import type { IdentityProvider } from './identity-provider';

/** External billing provider only. Checkout, portal, and webhooks stay real. */
export type BillingFault = 'none' | 'offline' | 'http-503';

export type BillingGate = {
  fault: BillingFault;
};

export function createBillingGate(): BillingGate {
  return { fault: 'none' };
}

function unavailable(): Promise<Response> {
  return Promise.reject(new Error('billing provider unavailable'));
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * Answers Stripe's HTTP API so an adapter that uses the injected vendor
 * `fetch` can succeed. The acceptance tests observe our HTTP API, not this.
 */
export function stripeFetch(
  gate: BillingGate,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (gate.fault === 'offline') return unavailable();
  if (gate.fault === 'http-503') {
    return Promise.resolve(new Response('', { status: 503 }));
  }
  const url = new URL(requestUrl(input));
  const method = init?.method ?? 'GET';
  if (method === 'POST' && url.pathname === '/v1/checkout/sessions') {
    return Promise.resolve(
      Response.json({
        id: 'cs_acceptance',
        url: 'https://billing.sim.local/c/cs_acceptance',
        customer: 'cus_acceptance',
      })
    );
  }
  if (method === 'POST' && url.pathname === '/v1/billing_portal/sessions') {
    return Promise.resolve(
      Response.json({
        id: 'bps_acceptance',
        url: 'https://billing.sim.local/p/bps_acceptance',
      })
    );
  }
  return Promise.resolve(
    new Response(JSON.stringify({ error: { message: url.pathname } }), {
      status: 404,
    })
  );
}

export function gateBilling(inner: Billing, gate: BillingGate): Billing {
  return {
    createPortalSession(input) {
      if (gate.fault !== 'none') {
        return Promise.reject(new Error('billing provider unavailable'));
      }
      return inner.createPortalSession(input);
    },
    syncCatalog(spec) {
      if (gate.fault !== 'none') {
        return Promise.reject(new Error('billing provider unavailable'));
      }
      return inner.syncCatalog(spec);
    },
  };
}

export function createVendorFetch(args: {
  readonly identity: IdentityProvider;
  readonly gate: BillingGate;
}): HttpClient['fetch'] {
  return (input, init) => {
    const raw = requestUrl(input);
    if (raw.startsWith('https://api.stripe.com/')) {
      return stripeFetch(args.gate, input, init);
    }
    return args.identity.fetch(input, init);
  };
}
