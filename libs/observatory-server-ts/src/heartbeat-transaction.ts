import type { LiveHeartbeat } from '@libs/observatory-shared-ts/live-session';
import { retryConflictingTransaction } from '@pkgs/sql-client-root-shared-ts/conflict-retry';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { type LiveDevice, LiveSessions } from './live-sessions';
import type { ObservatoryPorts } from './ports';

/** Replay only rolled-back database work; presence notifications happen after commit. */
export async function heartbeatTransaction(args: {
  readonly db: SqlClient;
  readonly ports: ObservatoryPorts;
  readonly device: LiveDevice;
  readonly value: LiveHeartbeat;
}): Promise<{ changed: boolean; watched: boolean }> {
  return retryConflictingTransaction(args.db, async (tx) => {
    const sessions = new LiveSessions(tx, args.ports);
    return {
      changed: await sessions.heartbeat(args.device, args.value),
      watched: await sessions.watched(args.device),
    };
  });
}
