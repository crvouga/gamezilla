import type { OriginAvailabilityPhase } from '@pkgs/http-client-shared-ts/origin-availability';

/**
 * Why the app is, or is not, connected right now. A person's own choice to
 * work offline, a device with no network, and the product being out of reach
 * call for different reassurance, so the shell names them apart.
 */
export type ConnectionCause =
  | 'connected'
  | 'checking'
  | 'workingOffline'
  | 'deviceOffline'
  | 'unreachable';

/** The three states Connection in Settings and its spec observe. */
export type ConnectionState = 'connected' | 'missing' | 'checking';

export function resolveConnectionCause(args: {
  readonly workingOffline: boolean;
  readonly deviceOnline: boolean;
  readonly origin: OriginAvailabilityPhase;
  /** A live, synced engine connection: proof the product answers. */
  readonly syncLive: boolean;
}): ConnectionCause {
  if (args.workingOffline) return 'workingOffline';
  if (!args.deviceOnline) return 'deviceOffline';
  if (args.origin === 'available' || args.syncLive) return 'connected';
  if (args.origin === 'probing') return 'checking';
  return 'unreachable';
}

export function connectionStateOf(cause: ConnectionCause): ConnectionState {
  if (cause === 'connected') return 'connected';
  if (cause === 'checking') return 'checking';
  return 'missing';
}
