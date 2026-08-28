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
  return (
    error instanceof RangeError &&
    (error.message.includes('closed database') ||
      error.message.includes('database is locked'))
  );
}

/** Skip expected closed-broker / closed-db noise; still surface unexpected push failures. */
export function warnPush(message: string, ...details: unknown[]): void {
  const error = details[details.length - 1];
  if (isPubSubClosedError(error) || isSqliteClosedError(error)) return;
  console.warn(message, ...details);
}
