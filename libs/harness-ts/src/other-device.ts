/**
 * Apart from the platform steps so that what reads a device's id (and ships
 * in the harness console's bundle) does not bring the step definitions along.
 */

/** The actor id of `actor`'s second device, signed into the same account. */
export function otherDevice(actor: string): string {
  return `${actor}_phone`;
}
