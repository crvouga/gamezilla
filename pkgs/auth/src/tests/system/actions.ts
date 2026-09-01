import { type ActionArbContext, defineAction } from '@pkgs/determinism';
import fc from 'fast-check';
import {
  AUTH_SESSION_TTL_MS,
  IDP_PROVIDER_DEV,
  IDP_PROVIDER_GOOGLE,
} from '../../shared/auth-constants';
import {
  dispatchOauthApprove,
  dispatchOauthStart,
  dispatchSessionExchange,
  dispatchSignOut,
  dispatchStealBearer,
  type OauthProvider,
} from './dispatch';
import type { AuthSystem } from './types';

export type AuthDomainOp =
  | {
      readonly kind: 'oauthStart';
      readonly clientId: string;
      readonly provider: OauthProvider;
      readonly callbackUrl: string;
    }
  | {
      readonly kind: 'oauthApprove';
      readonly clientId: string;
      readonly provider: OauthProvider;
      readonly subject: string;
    }
  | { readonly kind: 'sessionExchange'; readonly clientId: string }
  | { readonly kind: 'signOut'; readonly clientId: string }
  | {
      readonly kind: 'stealBearer';
      readonly from: string;
      readonly to: string;
    };

export type AdvanceClockAction = {
  readonly kind: 'advanceClock';
  readonly ms: number;
};

export type GoogleFaultAction = {
  readonly kind: 'setGoogleFault';
  readonly fault: boolean;
};

export type AuthAction = AuthDomainOp | AdvanceClockAction | GoogleFaultAction;

export type AuthModel = Record<string, never>;

const SUBJECTS = ['alice', 'bob', 'carol'] as const;
const PROVIDERS = [IDP_PROVIDER_GOOGLE, IDP_PROVIDER_DEV] as const;
const CALLBACK_URLS = [
  'http://callback.test/sso',
  'gamezilla://sso-callback',
  'https://evil.example/sso',
] as const;

function clientArb(ctx: ActionArbContext): fc.Arbitrary<string> {
  const clients = ctx.roleIds('client');
  if (clients.length === 0) return fc.constant('c0');
  return fc.constantFrom(...clients);
}

export const advanceClockAction = defineAction<
  AuthSystem,
  AdvanceClockAction,
  AuthModel
>({
  kind: 'advanceClock',
  class: 'library',
  arb: () =>
    fc.record({
      kind: fc.constant('advanceClock' as const),
      ms: fc.constantFrom(1_000, AUTH_SESSION_TTL_MS + 1),
    }),
  dispatch: async (world, action) => {
    await world.advance(action.ms);
  },
});

export const setGoogleFaultAction = defineAction<
  AuthSystem,
  GoogleFaultAction,
  AuthModel
>({
  kind: 'setGoogleFault',
  class: 'library',
  arb: () =>
    fc.record({
      kind: fc.constant('setGoogleFault' as const),
      fault: fc.boolean(),
    }),
  dispatch: async (world, action) => {
    world.state.googleFault = action.fault;
  },
});

export const oauthStartAction = defineAction<
  AuthSystem,
  Extract<AuthDomainOp, { kind: 'oauthStart' }>,
  AuthModel
>({
  kind: 'oauthStart',
  class: 'domain',
  arb: (ctx) =>
    fc.record({
      kind: fc.constant('oauthStart' as const),
      clientId: clientArb(ctx),
      provider: fc.constantFrom(...PROVIDERS),
      callbackUrl: fc.constantFrom(...CALLBACK_URLS),
    }),
  dispatch: async (world, action) => {
    await dispatchOauthStart(
      world,
      action.clientId,
      action.provider,
      action.callbackUrl
    );
  },
});

export const oauthApproveAction = defineAction<
  AuthSystem,
  Extract<AuthDomainOp, { kind: 'oauthApprove' }>,
  AuthModel
>({
  kind: 'oauthApprove',
  class: 'domain',
  arb: (ctx) =>
    fc.record({
      kind: fc.constant('oauthApprove' as const),
      clientId: clientArb(ctx),
      provider: fc.constantFrom(...PROVIDERS),
      subject: fc.constantFrom(...SUBJECTS),
    }),
  dispatch: async (world, action) => {
    await dispatchOauthApprove(
      world,
      action.clientId,
      action.provider,
      action.subject
    );
  },
});

export const sessionExchangeAction = defineAction<
  AuthSystem,
  Extract<AuthDomainOp, { kind: 'sessionExchange' }>,
  AuthModel
>({
  kind: 'sessionExchange',
  class: 'domain',
  arb: (ctx) =>
    fc.record({
      kind: fc.constant('sessionExchange' as const),
      clientId: clientArb(ctx),
    }),
  dispatch: async (world, action) => {
    await dispatchSessionExchange(world, action.clientId);
  },
});

export const signOutAction = defineAction<
  AuthSystem,
  Extract<AuthDomainOp, { kind: 'signOut' }>,
  AuthModel
>({
  kind: 'signOut',
  class: 'domain',
  arb: (ctx) =>
    fc.record({
      kind: fc.constant('signOut' as const),
      clientId: clientArb(ctx),
    }),
  dispatch: async (world, action) => {
    await dispatchSignOut(world, action.clientId);
  },
});

export const stealBearerAction = defineAction<
  AuthSystem,
  Extract<AuthDomainOp, { kind: 'stealBearer' }>,
  AuthModel
>({
  kind: 'stealBearer',
  class: 'domain',
  arb: (ctx) => {
    const client = clientArb(ctx);
    return fc.record({
      kind: fc.constant('stealBearer' as const),
      from: client,
      to: client,
    });
  },
  dispatch: async (world, action) => {
    dispatchStealBearer(world, action.from, action.to);
  },
});

export const AUTH_ACTIONS = [
  advanceClockAction,
  setGoogleFaultAction,
  oauthStartAction,
  oauthApproveAction,
  sessionExchangeAction,
  signOutAction,
  stealBearerAction,
] as const;

/** Full pool (domain + library) — used by the dual-open determinism test. */
export function arbAuthAction(
  clientIds: readonly string[]
): fc.Arbitrary<AuthAction> {
  const client = fc.constantFrom(...clientIds);
  return fc.oneof(
    fc.record({
      kind: fc.constant('oauthStart' as const),
      clientId: client,
      provider: fc.constantFrom(...PROVIDERS),
      callbackUrl: fc.constantFrom(...CALLBACK_URLS),
    }),
    fc.record({
      kind: fc.constant('oauthApprove' as const),
      clientId: client,
      provider: fc.constantFrom(...PROVIDERS),
      subject: fc.constantFrom(...SUBJECTS),
    }),
    fc.record({
      kind: fc.constant('sessionExchange' as const),
      clientId: client,
    }),
    fc.record({ kind: fc.constant('signOut' as const), clientId: client }),
    fc.record({
      kind: fc.constant('stealBearer' as const),
      from: client,
      to: client,
    }),
    fc.record({
      kind: fc.constant('advanceClock' as const),
      ms: fc.constantFrom(1_000, AUTH_SESSION_TTL_MS + 1),
    }),
    fc.record({
      kind: fc.constant('setGoogleFault' as const),
      fault: fc.boolean(),
    })
  );
}
