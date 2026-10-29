/**
 * One simulated device: the production client port (`createInhouseAuthClient`)
 * over a headless browser that keeps its cookies between sign-ins (so the
 * providers' account choosers appear exactly when they would), behind a
 * network switch that can take the device offline.
 */

import { AUTH_SSO_CANCELLED_ERROR } from '@pkgs/auth-inhouse-client-ts/auth-client-http';
import { createInhouseAuthClient } from '@pkgs/auth-inhouse-client-ts/create-inhouse-auth-client';
import {
  createAuthCookieJar,
  createInProcessOpenAuthSession,
} from '@pkgs/auth-inhouse-client-ts/in-process-open-auth-session';
import {
  createBearerTokenStore,
  createInMemoryAuthClientStorage,
} from '@pkgs/auth-inhouse-shared-ts/bearer-token-store';
import { AuthFlowError } from '@pkgs/auth-root-client-ts/auth-flow-error';
import { AuthLinkRequiredError } from '@pkgs/auth-root-client-ts/auth-link-required-error';
import { AUTH_ERROR } from '@pkgs/auth-root-shared-ts/auth-error-code';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';

import {
  AUTH_SYSTEM_BASE_URL,
  AUTH_SYSTEM_CALLBACK_URL,
} from './relying-party';
import type { ActorOutcome, ActorState, AuthStore } from './types';

/** What a browser throws when the network is gone. */
export const OFFLINE_ERROR = 'Failed to fetch (offline)';

export function startActor(args: {
  readonly id: string;
  readonly store: AuthStore;
  readonly session: Session;
}): ActorState {
  const bearerStore = createBearerTokenStore({
    storage: createInMemoryAuthClientStorage(),
    storageKey: 'myapp.auth.bearer',
  });
  const jar = createAuthCookieJar();
  const state = {
    online: true,
    answers: { email: '', consent: 'allow', emailChoice: 'share' },
  } as Pick<ActorState, 'online' | 'answers'>;
  const fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    if (!state.online) throw new TypeError(OFFLINE_ERROR);
    const url = input instanceof Request ? input.url : String(input);
    return await args.store.wire(url, init);
  };
  const port = createInhouseAuthClient({
    baseURL: AUTH_SYSTEM_BASE_URL,
    clock: args.session.ports.clock,
    timers: args.session.ports.timers,
    fetch,
    bearerStore,
    callbackUrl: AUTH_SYSTEM_CALLBACK_URL,
    openAuthSession: (url, callbackUrl) =>
      createInProcessOpenAuthSession({
        fetch,
        jar,
        account: { email: state.answers.email },
        consent: state.answers.consent,
        answers: { email_choice: state.answers.emailChoice },
      })(url, callbackUrl),
  });
  return Object.assign(state, {
    id: args.id,
    port,
    bearerStore,
    pendingLink: null,
    last: null,
    offered: null,
    ticket: null,
    bearer: null,
  });
}

/** How a client call ended, as the UI would have to tell it. */
export function classify(error: unknown): ActorOutcome {
  if (error instanceof AuthLinkRequiredError) {
    return { kind: 'link_required', token: error.token };
  }
  if (error instanceof AuthFlowError)
    return { kind: 'error', code: error.code };
  const message = error instanceof Error ? error.message : String(error);
  if (message === AUTH_SSO_CANCELLED_ERROR) {
    return { kind: 'error', code: AUTH_ERROR.cancelled };
  }
  return { kind: 'failed', message };
}

export async function runClient(
  actor: ActorState,
  call: () => Promise<unknown>
): Promise<ActorOutcome> {
  let outcome: ActorOutcome;
  try {
    await call();
    outcome = { kind: 'ok' };
  } catch (error) {
    outcome = classify(error);
  }
  actor.last = outcome;
  actor.bearer = await actor.bearerStore.read();
  return outcome;
}
