/**
 * Optional suspend/resume around heavy DB subprocess phases (migrate, etc.)
 * so the parent infra process does not hold a Postgres connection slot while
 * the child opens its own `pg` pool.
 */
type LockDbSessionHooks = {
  suspend: () => Promise<void>;
  resume: () => Promise<void>;
};

let hooks: LockDbSessionHooks | null = null;

export function registerLockDbSessionHooks(
  next: LockDbSessionHooks | null
): void {
  hooks = next;
}

/** Runs `fn` with the lock DB connection closed for the duration (if registered). */
export async function withLockDbSuspended<T>(fn: () => Promise<T>): Promise<T> {
  if (hooks === null) {
    return fn();
  }
  await hooks.suspend();
  try {
    return await fn();
  } finally {
    await hooks.resume();
  }
}
