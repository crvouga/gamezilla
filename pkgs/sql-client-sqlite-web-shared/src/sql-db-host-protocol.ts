/**
 * SharedWorker generation for the db-host broker.
 * Bump when the broker wire protocol changes incompatibly — a new name
 * isolates deploy-drift tabs from a stale SharedWorker instance.
 */
export const SQL_DB_HOST_PROTOCOL_VERSION = 1;

export function sqlDbHostSharedWorkerName(
  protocolVersion: number = SQL_DB_HOST_PROTOCOL_VERSION
): string {
  return `sql-db-host-v${protocolVersion}`;
}
