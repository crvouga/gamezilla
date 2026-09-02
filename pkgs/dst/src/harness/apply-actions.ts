/** Fixed post-step quantum after each Action is applied (virtual ms). */
export const STEP_MS = 10;

/** The single Action-application loop shared by World.apply and replay. */
export async function applyActions(args: {
  readonly advance: (ms: number) => Promise<void>;
  readonly actions: readonly { readonly kind: string }[];
  readonly apply: (action: { readonly kind: string }) => Promise<void>;
  readonly checkStep?: () => Promise<void>;
}): Promise<void> {
  const checkStep = args.checkStep ?? (async () => undefined);
  for (const action of args.actions) {
    await args.apply(action);
    await args.advance(STEP_MS);
    await checkStep();
  }
}
