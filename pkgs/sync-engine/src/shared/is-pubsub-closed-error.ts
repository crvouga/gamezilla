import { PubSubClosedError } from '@pkgs/pubsub/pubsub-closed-error';

/** Broker down / peer closed — best-effort publish/subscribe, not a product bug. */
export function isPubSubClosedError(error: unknown): boolean {
  return (
    error instanceof PubSubClosedError ||
    (error instanceof Error && error.name === 'PubSubClosedError')
  );
}

/** Sim/client restart can close SQLite while push teardown is in flight. */
export function isSqliteClosedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /closed database|database has closed|already closed|database is closed|database is locked/i.test(
      message
    )
  ) {
    return true;
  }
  return error instanceof Error && error.cause !== undefined
    ? isSqliteClosedError(error.cause)
    : false;
}

/** Skip expected closed-broker / closed-db noise; still surface unexpected push failures. */
export function warnPush(message: string, ...details: unknown[]): void {
  const error = details[details.length - 1];
  if (isPubSubClosedError(error) || isSqliteClosedError(error)) return;
  console.warn(message, ...details);
}
