/** How long a connection check may wait on a query sweep before the action proceeds. */
export const CONNECTION_CHECK_BUDGET_MS = 3_000;

/**
 * Whether the server can be reached, without letting a sweep that never
 * finishes hold the action. A hung sweep used to leave Join on "Joining…",
 * so End never appeared and a leftover hosted space stayed live.
 */
export async function onlineAfterRefresh(args: {
  readonly refresh: () => Promise<void>;
  readonly online: () => boolean;
  readonly budgetMs: number;
  readonly schedule: (ms: number, run: () => void) => () => void;
}): Promise<boolean> {
  let cancel = (): void => undefined;
  const budget = new Promise<void>((resolve) => {
    cancel = args.schedule(args.budgetMs, resolve);
  });
  await Promise.race([
    args.refresh().then(
      () => undefined,
      () => undefined
    ),
    budget,
  ]);
  cancel();
  return args.online();
}
