/**
 * Process-wide durable epoch for sim client namespaces.
 *
 * Each `createSim` bumps the epoch so a prior sim that signed in cannot leave
 * a `sessionToken` behind for the next boot's guest client to replay against a
 * fresh Postgres.
 */

let clientDurableEpoch = 0;

/** Bump the process-wide client durable epoch (namespace isolation). */
export function bumpSimClientEpoch(): number {
  clientDurableEpoch += 1;
  return clientDurableEpoch;
}

export function simClientNamespace(id: string): string {
  return `sim_client_${id}_e${clientDurableEpoch}`;
}
