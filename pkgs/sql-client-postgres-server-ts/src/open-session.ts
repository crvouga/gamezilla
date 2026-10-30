/** Stages the driver can distinguish; transport includes handshake and authentication. */
export type PgOpenStage = 'transport' | 'schema';
export type ObservePgOpen = (
  stage: PgOpenStage,
  run: () => Promise<void>
) => Promise<void>;

/** A failed open must release its session without replacing the original error. */
export async function openSession(args: {
  readonly connect: () => Promise<void>;
  readonly initialize: () => Promise<void>;
  readonly close: () => Promise<void>;
  readonly observe?: ObservePgOpen;
}): Promise<void> {
  const observe: ObservePgOpen = args.observe ?? ((_stage, run) => run());
  try {
    await observe('transport', args.connect);
    await observe('schema', args.initialize);
  } catch (error) {
    await args.close().catch(() => undefined);
    throw error;
  }
}
