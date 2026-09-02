import { type ActionGeneratorContext, actions } from '@pkgs/dst';
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
import type { AuthSurface } from './types';

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

const SUBJECTS = ['alice', 'bob', 'carol'] as const;
const PROVIDERS = [IDP_PROVIDER_GOOGLE, IDP_PROVIDER_DEV] as const;
const CALLBACK_URLS = [
  'http://callback.test/sso',
  'gamezilla://sso-callback',
  'https://evil.example/sso',
] as const;

function clientArb(
  ctx: ActionGeneratorContext<AuthSurface>
): fc.Arbitrary<string> {
  const clients = ctx.nodeIds('client');
  if (clients.length === 0) return fc.constant('c0');
  return fc.constantFrom(...clients);
}

export const AUTH_ACTIONS = actions<AuthSurface>()({
  advanceClock: {
    weight: 1,
    generate: () =>
      fc.record({
        kind: fc.constant('advanceClock' as const),
        ms: fc.constantFrom(1_000, AUTH_SESSION_TTL_MS + 1),
      }),
    apply: async (surface, payload) => {
      const action = payload as AdvanceClockAction;
      await surface.advance(action.ms);
    },
  },
  setGoogleFault: {
    weight: 1,
    generate: () =>
      fc.record({
        kind: fc.constant('setGoogleFault' as const),
        fault: fc.boolean(),
      }),
    apply: async (surface, payload) => {
      const action = payload as GoogleFaultAction;
      (surface.nodes['store'] as import('./types').AuthStore).sim.googleFault =
        action.fault;
    },
  },
  oauthStart: {
    weight: 3,
    generate: (ctx) =>
      fc.record({
        kind: fc.constant('oauthStart' as const),
        clientId: clientArb(ctx),
        provider: fc.constantFrom(...PROVIDERS),
        callbackUrl: fc.constantFrom(...CALLBACK_URLS),
      }),
    apply: async (surface, payload) => {
      const action = payload as Extract<AuthDomainOp, { kind: 'oauthStart' }>;
      await dispatchOauthStart(
        surface,
        action.clientId,
        action.provider,
        action.callbackUrl
      );
    },
  },
  oauthApprove: {
    weight: 3,
    generate: (ctx) =>
      fc.record({
        kind: fc.constant('oauthApprove' as const),
        clientId: clientArb(ctx),
        provider: fc.constantFrom(...PROVIDERS),
        subject: fc.constantFrom(...SUBJECTS),
      }),
    apply: async (surface, payload) => {
      const action = payload as Extract<AuthDomainOp, { kind: 'oauthApprove' }>;
      await dispatchOauthApprove(
        surface,
        action.clientId,
        action.provider,
        action.subject
      );
    },
  },
  sessionExchange: {
    weight: 3,
    generate: (ctx) =>
      fc.record({
        kind: fc.constant('sessionExchange' as const),
        clientId: clientArb(ctx),
      }),
    apply: async (surface, payload) => {
      const action = payload as Extract<
        AuthDomainOp,
        { kind: 'sessionExchange' }
      >;
      await dispatchSessionExchange(surface, action.clientId);
    },
  },
  signOut: {
    weight: 3,
    generate: (ctx) =>
      fc.record({
        kind: fc.constant('signOut' as const),
        clientId: clientArb(ctx),
      }),
    apply: async (surface, payload) => {
      const action = payload as Extract<AuthDomainOp, { kind: 'signOut' }>;
      await dispatchSignOut(surface, action.clientId);
    },
  },
  stealBearer: {
    weight: 3,
    generate: (ctx) => {
      const client = clientArb(ctx);
      return fc.record({
        kind: fc.constant('stealBearer' as const),
        from: client,
        to: client,
      });
    },
    apply: async (surface, payload) => {
      const action = payload as Extract<AuthDomainOp, { kind: 'stealBearer' }>;
      dispatchStealBearer(surface, action.from, action.to);
    },
  },
});
