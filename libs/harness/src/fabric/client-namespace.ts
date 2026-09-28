/**
 * Process-wide durable epoch for harness client namespaces.
 *
 * Each `createHarness` bumps the epoch so a prior harness that signed in cannot leave
 * a `sessionToken` behind for the next boot's guest client to replay against a
 * fresh Postgres.
 */

let clientDurableEpoch = 0;

/** Bump the process-wide client durable epoch (namespace isolation). */
export function bumpHarnessClientEpoch(): number {
  clientDurableEpoch += 1;
  return clientDurableEpoch;
}

export function harnessClientNamespace(id: string): string {
  return `harness_client_${id}_e${clientDurableEpoch}`;
}
