/**
 * The world a `specs/auth/` model's traces run in: the auth harness the
 * binding's `init` opens, disposed after the last step, plus the number the
 * model gives each account (in the order the accounts appear).
 *
 * Nothing in the model waits on time, so the state is compared right after
 * each step: letting virtual time run would move the clocks sign-ins and
 * address matches lapse by.
 */

import type { AuthSurface } from '@pkgs/auth-harness';
import type { Run } from '@pkgs/harness';
import { setQuintWorld, type TraceContext } from '@pkgs/quint/registry';

export type SignInTraceWorld = {
  readonly ctx: TraceContext;
  harness: Run<AuthSurface> | null;
  /** Account id → the model's number for it. */
  readonly accountNumbers: Map<string, number>;
};

export function traceAuth(w: SignInTraceWorld): Run<AuthSurface> {
  if (w.harness === null)
    throw new Error('no auth harness — the binding init opens one');
  return w.harness;
}

/** The model's number for an account, handing out the next one to a new account. */
export function accountNumber(w: SignInTraceWorld, id: string): number {
  const known = w.accountNumbers.get(id);
  if (known !== undefined) return known;
  const next = w.accountNumbers.size + 1;
  w.accountNumbers.set(id, next);
  return next;
}

export function useSignInTraceWorld(): void {
  setQuintWorld<SignInTraceWorld>({
    create: async (ctx) => ({ ctx, harness: null, accountNumbers: new Map() }),
    dispose: async (w) => {
      await w.harness?.[Symbol.asyncDispose]();
    },
  });
}
