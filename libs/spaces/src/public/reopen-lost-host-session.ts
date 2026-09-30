/**
 * A host who leaves ends the space. A live space whose session on this
 * device was tombstoned is a session the device lost, not a step-out: reopen
 * it. Another device has no session row and still uses the join screen.
 */
export function shouldReopenLostHostSession(args: {
  readonly isHost: boolean;
  /** Tombstone timestamp when this device's session row exists and is closed. */
  readonly sessionDeletedAt: string | null | undefined;
}): boolean {
  return (
    args.isHost &&
    args.sessionDeletedAt != null &&
    args.sessionDeletedAt.length > 0
  );
}
