export type NetEffect = Disposable & {
  readonly restore: () => void;
};

/**
 * Tiny apply/restore helper for network topology effects.
 * `apply` runs once at construction; `restore` / dispose are idempotent.
 */
export function createNetEffect(
  apply: () => void,
  restore: () => void
): NetEffect {
  apply();
  let restored = false;
  const runRestore = (): void => {
    if (restored) return;
    restored = true;
    restore();
  };
  return {
    restore: runRestore,
    [Symbol.dispose]: runRestore,
  };
}
