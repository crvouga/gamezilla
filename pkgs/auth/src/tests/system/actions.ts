import fc from 'fast-check';
import { AUTH_SESSION_TTL_MS } from '../../shared/auth-constants';

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

const SUBJECTS = ['alice', 'bob', 'carol'] as const;
const CALLBACK_URLS = [
  'http://callback.test/sso',
  'gamezilla://sso-callback',
  'https://evil.example/sso',
] as const;

export function arbAdvanceClock(): fc.Arbitrary<AdvanceClockAction> {
  return fc.record({
    kind: fc.constant('advanceClock' as const),
    ms: fc.constantFrom(1_000, AUTH_SESSION_TTL_MS + 1),
  });
}

export function arbGoogleFault(): fc.Arbitrary<GoogleFaultAction> {
  return fc.record({
    kind: fc.constant('setGoogleFault' as const),
    fault: fc.boolean(),
  });
}

export function arbAuthDomainOps(
  clientIds: readonly string[]
): readonly fc.Arbitrary<AuthDomainOp>[] {
  const client = fc.constantFrom(...clientIds);
  return [
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
  ];
}

/** Full pool (domain + library) — used by the dual-open determinism test. */
export function arbAuthAction(
  clientIds: readonly string[]
): fc.Arbitrary<AuthAction> {
  return fc.oneof<fc.Arbitrary<AuthAction>[]>(
    ...arbAuthDomainOps(clientIds),
    arbAdvanceClock(),
    arbGoogleFault()
  );
}
