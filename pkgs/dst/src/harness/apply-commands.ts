/** Fixed post-step quantum after each Command is applied (virtual ms). */
export const COMMAND_STEP_MS = 10;

/** The single Command-application loop shared by World.apply and replay. */
export async function applyCommands(args: {
  readonly advance: (ms: number) => Promise<void>;
  readonly commands: readonly { readonly kind: string }[];
  readonly apply: (command: { readonly kind: string }) => Promise<void>;
  readonly checkAlways?: () => Promise<void>;
}): Promise<void> {
  const checkAlways = args.checkAlways ?? (async () => undefined);
  for (const command of args.commands) {
    await args.apply(command);
    await args.advance(COMMAND_STEP_MS);
    await checkAlways();
  }
}
