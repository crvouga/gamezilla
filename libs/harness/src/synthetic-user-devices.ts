/**
 * Which simulated devices are a Synthetic User's application host: the app as
 * the Synthetic Population Worker runs it, the one place email sign-in is
 * offered. Every other device is a person's, and never offers it.
 *
 * The app reads this once, when it starts, exactly as the worker's host is
 * built: a device becomes a host before its app first launches.
 */

export type HarnessSyntheticUserDevices = {
  readonly has: (clientId: string) => boolean;
  readonly add: (clientId: string) => void;
};

export function createHarnessSyntheticUserDevices(): HarnessSyntheticUserDevices {
  const hosts = new Set<string>();
  return {
    has: (clientId) => hosts.has(clientId),
    add: (clientId) => {
      hosts.add(clientId);
    },
  };
}
