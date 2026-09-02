/** Fixed post-step quantum after each action dispatch (virtual ms). */
export const PLAY_STEP_MS = 10;

export async function playActions(args: {
  readonly advance: (ms: number) => Promise<void>;
  readonly actions: readonly { readonly kind: string }[];
  readonly dispatch: (action: { readonly kind: string }) => Promise<void>;
  readonly runInvariants?: () => Promise<void>;
}): Promise<void> {
  const runInvariants = args.runInvariants ?? (async () => undefined);
  for (const action of args.actions) {
    await args.dispatch(action);
    await args.advance(PLAY_STEP_MS);
    await runInvariants();
  }
}
