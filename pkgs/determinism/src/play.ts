export type InvariantViolation = {
  readonly invariant: string;
  readonly detail: string;
};

/** Fixed post-step quantum after each action dispatch (virtual ms). */
export const PLAY_STEP_MS = 10;

export type PlayActionsArgs = {
  readonly advance: (ms: number) => Promise<void>;
  readonly actions: readonly { readonly kind: string }[];
  readonly dispatch: (action: { readonly kind: string }) => Promise<void>;
};

/**
 * Framework-owned play loop: dispatch → advance(PLAY_STEP_MS).
 * Converge / safety checks run after settle via {@link World.settle}.
 */
export async function playActions(args: PlayActionsArgs): Promise<void> {
  for (let index = 0; index < args.actions.length; index += 1) {
    const action = args.actions[index]!;
    await args.dispatch(action);
    await args.advance(PLAY_STEP_MS);
  }
}

export function throwIfInvariant(
  inv: InvariantViolation | null,
  seed: bigint
): void {
  if (inv === null) return;
  throw new Error(`${inv.invariant} seed=${seed.toString(16)}: ${inv.detail}`);
}
