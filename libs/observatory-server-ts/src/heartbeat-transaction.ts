import type { LiveHeartbeat } from '@libs/observatory-shared-ts/live-session';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { isTransientConflict } from '@pkgs/sql-client-root-shared-ts/transient-conflict';
import { type LiveDevice, LiveSessions } from './live-sessions';
import type { ObservatoryPorts } from './ports';

/** Replay only rolled-back database work; presence notifications happen after commit. */
export async function heartbeatTransaction(args: {
  readonly db: SqlClient;
  readonly ports: ObservatoryPorts;
  readonly device: LiveDevice;
  readonly value: LiveHeartbeat;
}): Promise<{ changed: boolean; watched: boolean }> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await args.db.transaction(async (tx) => {
        const sessions = new LiveSessions(tx, args.ports);
        return {
          changed: await sessions.heartbeat(args.device, args.value),
          watched: await sessions.watched(args.device),
        };
      });
    } catch (error) {
      if (attempt >= 3 || !isTransientConflict(error)) throw error;
    }
  }
}
