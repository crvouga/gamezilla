import { type ActionArbContext, defineAction } from '@pkgs/determinism';
import fc from 'fast-check';
import { AUTH_SESSION_TTL_MS } from '../../shared/auth-constants';
import {
  dispatchDevComplete,
  dispatchGoogleApprove,
  dispatchGoogleStart,
  dispatchSessionExchange,
  dispatchSignOut,
  dispatchStealBearer,
} from './dispatch';
import type { AuthSystem } from './types';

export type AuthDomainOp =
  | {
      readonly kind: 'devComplete';
      readonly clientId: string;
      readonly subject: string;
    }
  | {
      readonly kind: 'googleStart';
      readonly clientId: string;
      readonly callbackUrl: string;
    }
  | {
      readonly kind: 'googleApprove';
      readonly clientId: string;
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

export const devCompleteAction = defineAction<
  AuthSystem,
  Extract<AuthDomainOp, { kind: 'devComplete' }>,
  AuthModel
>({
  kind: 'devComplete',
  class: 'domain',
  arb: (ctx) =>
    fc.record({
      kind: fc.constant('devComplete' as const),
      clientId: clientArb(ctx),
      subject: fc.constantFrom(...SUBJECTS),
    }),
  dispatch: async (world, action) => {
    await dispatchDevComplete(world, action.clientId, action.subject);
  },
});

export const googleStartAction = defineAction<
  AuthSystem,
  Extract<AuthDomainOp, { kind: 'googleStart' }>,
  AuthModel
>({
  kind: 'googleStart',
  class: 'domain',
  arb: (ctx) =>
    fc.record({
      kind: fc.constant('googleStart' as const),
      clientId: clientArb(ctx),
      callbackUrl: fc.constantFrom(...CALLBACK_URLS),
    }),
  dispatch: async (world, action) => {
    await dispatchGoogleStart(world, action.clientId, action.callbackUrl);
  },
});

export const googleApproveAction = defineAction<
  AuthSystem,
  Extract<AuthDomainOp, { kind: 'googleApprove' }>,
  AuthModel
>({
  kind: 'googleApprove',
  class: 'domain',
  arb: (ctx) =>
    fc.record({
      kind: fc.constant('googleApprove' as const),
      clientId: clientArb(ctx),
      subject: fc.constantFrom(...SUBJECTS),
    }),
  dispatch: async (world, action) => {
    await dispatchGoogleApprove(world, action.clientId, action.subject);
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
  devCompleteAction,
  googleStartAction,
  googleApproveAction,
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
      kind: fc.constant('devComplete' as const),
      clientId: client,
      subject: fc.constantFrom(...SUBJECTS),
    }),
    fc.record({
      kind: fc.constant('googleStart' as const),
      clientId: client,
      callbackUrl: fc.constantFrom(...CALLBACK_URLS),
    }),
    fc.record({
      kind: fc.constant('googleApprove' as const),
      clientId: client,
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
