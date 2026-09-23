import { createServer } from '@apps/server';
import type { Session } from '@pkgs/sim';
import {
  defineAction,
  defineRuntime,
  defineSystem,
  virtualTimeRuntime,
} from '@pkgs/sim';

import { createSim, type Sim } from '../fabric/create-sim';
import {
  type BillingFault,
  type BillingGate,
  createBillingGate,
  createVendorFetch,
  gateBilling,
} from './billing-provider';
import {
  createIdentityProvider,
  type IdentityProvider,
} from './identity-provider';

export type ApiObservation = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

export type AcceptanceApi = {
  session: Session;
  sim: Sim;
  provider: IdentityProvider;
  gate: BillingGate;
  app: Awaited<ReturnType<typeof createServer>>;
  responses: Map<string, ApiObservation>;
};

export type ApiRequest = {
  key: string;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  rawBody?: string;
};

function requestBody(input: ApiRequest): { body?: string } {
  if (input.rawBody !== undefined) return { body: input.rawBody };
  if (input.body === undefined) return {};
  return { body: JSON.stringify(input.body) };
}

export const request = defineAction({
  name: 'acceptance.http',
  async act(s: AcceptanceApi, input: ApiRequest) {
    const response = await s.app.request(
      `http://localhost:8788/api${input.path}`,
      {
        method: input.method ?? 'POST',
        headers: {
          'content-type': 'application/json',
          ...input.headers,
        },
        ...requestBody(input),
        redirect: 'manual',
      }
    );
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // HTML and empty redirects are valid observations.
    }
    s.responses.set(input.key, {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body,
    });
  },
});

export const providerIdentity = defineAction({
  name: 'acceptance.providerIdentity',
  act(
    s: AcceptanceApi,
    identity: { sub: string; email: string | null; verified: boolean }
  ) {
    s.provider.identity = identity;
  },
});

export const providerFault = defineAction({
  name: 'acceptance.providerFault',
  act(s: AcceptanceApi, fault: IdentityProvider['fault']) {
    s.provider.fault = fault;
  },
});

export const appleResponse = defineAction({
  name: 'acceptance.appleResponse',
  act(s: AcceptanceApi, token: string, publicKey: unknown) {
    s.provider.appleToken = token;
    s.provider.appleKeys = [publicKey];
  },
});

export const billingFault = defineAction({
  name: 'acceptance.billingFault',
  act(s: AcceptanceApi, fault: BillingFault) {
    s.gate.fault = fault;
  },
});

export const apiNow = (s: AcceptanceApi) => s.session.ports.clock.now();

export function response(s: AcceptanceApi, key: string): ApiObservation {
  const result = s.responses.get(key);
  if (result === undefined) throw new Error(`No HTTP observation for ${key}`);
  return result;
}

export const acceptanceApi = defineSystem({
  name: 'acceptance.api',
  args: {},
  async create(session): Promise<AcceptanceApi> {
    const sim = await createSim(session);
    session.onDispose(() => sim.dispose());
    const provider = createIdentityProvider();
    const gate = createBillingGate();
    const billing = sim.server.billing;
    if (billing === null) throw new Error('acceptance billing port missing');
    // Apple is part of the contract. The auth provider type has no Apple
    // config yet, so Apple scenarios stay red until the product accepts it.
    const app = await createServer({
      ...sim.server,
      fetch: createVendorFetch({ identity: provider, gate }),
      billing: gateBilling(billing, gate),
      auth: {
        ...sim.server.auth,
        baseURL: 'http://localhost:8788',
        trustedOrigins: ['http://localhost:5173'],
        googleEnabled: true,
        providers: {
          google: {
            clientId: 'acceptance-google',
            clientSecret: 'fixture-secret',
          },
          dev: { enabled: true as const },
        },
      },
    });
    return {
      session,
      sim,
      provider,
      gate,
      app,
      responses: new Map(),
    };
  },
  runtimes: [
    defineRuntime({
      name: 'in-process',
      default: true,
      create: () => virtualTimeRuntime({ startTime: 1_800_000_000_000 }),
    }),
  ],
  actions: [
    request,
    providerIdentity,
    providerFault,
    appleResponse,
    billingFault,
  ],
});
