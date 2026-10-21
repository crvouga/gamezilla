import type { OriginAvailabilityPhase } from '@pkgs/http-client-shared-ts/origin-availability';

export type OriginRevalidate = {
  readonly sawUnavailable: boolean;
  readonly revalidate: boolean;
};

/**
 * A signed-in device rechecks its session when the origin comes back, not
 * only on the minute interval. The first time the origin is reachable is
 * boot, and that already refreshes; only a real outage arms the recheck.
 */
export function originRevalidate(
  sawUnavailable: boolean,
  phase: OriginAvailabilityPhase
): OriginRevalidate {
  if (phase === 'unavailable') {
    return { sawUnavailable: true, revalidate: false };
  }
  if (phase === 'available' && sawUnavailable) {
    return { sawUnavailable: false, revalidate: true };
  }
  return { sawUnavailable, revalidate: false };
}
