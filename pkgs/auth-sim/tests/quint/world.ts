/**
 * The world a `specs/sign-in/` model's traces run in: the auth sim the
 * binding's `init` opens, disposed after the last step, plus the number the
 * model gives each account (in the order the accounts appear).
 *
 * Nothing in the model waits on time, so the state is compared right after
 * each step: letting virtual time run would move the clocks sign-ins and
 * address matches lapse by.
 */

import type { AuthSurface } from '@pkgs/auth-sim';
import { setQuintWorld, type TraceContext } from '@pkgs/quint/registry';
import type { Run } from '@pkgs/sim';

export type SignInTraceWorld = {
  readonly ctx: TraceContext;
  sim: Run<AuthSurface> | null;
  /** Account id → the model's number for it. */
  readonly accountNumbers: Map<string, number>;
};

export function traceAuth(w: SignInTraceWorld): Run<AuthSurface> {
  if (w.sim === null)
    throw new Error('no auth sim — the binding init opens one');
  return w.sim;
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
    create: async (ctx) => ({ ctx, sim: null, accountNumbers: new Map() }),
    dispose: async (w) => {
      await w.sim?.[Symbol.asyncDispose]();
    },
  });
}
