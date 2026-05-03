/**
 * Bridges {@link AuthService} sign-in/out with {@link PatchBootstrap} without a React
 * context cycle (bootstrap wraps auth). Registered once from `PatchBootstrap`.
 */
export type PatchDbLifecycleCallbacks = {
  readonly reopenAsAccount: (accountId: string) => Promise<void>;
  readonly reopenAsAnonymous: () => Promise<void>;
};

let callbacks: PatchDbLifecycleCallbacks | null = null;

export function registerPatchDbLifecycleCallbacks(
  next: PatchDbLifecycleCallbacks | null
): void {
  callbacks = next;
}

export async function reopenPatchDbAsAccount(accountId: string): Promise<void> {
  const c = callbacks;
  if (c === null) {
    throw new Error('Patch DB lifecycle not registered');
  }
  await c.reopenAsAccount(accountId);
}

export async function reopenPatchDbAsAnonymous(): Promise<void> {
  const c = callbacks;
  if (c === null) {
    throw new Error('Patch DB lifecycle not registered');
  }
  await c.reopenAsAnonymous();
}
