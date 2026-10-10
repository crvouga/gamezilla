const AWAY_PREFIX = 'away:';

/** A host can remain available while their space is not on screen. */
export function spacePresenceClientId(
  sessionClientId: string,
  viewing: boolean
): string {
  return viewing ? sessionClientId : `${AWAY_PREFIX}${sessionClientId}`;
}

/** Availability connections do not count as people viewing the space. */
export function isViewingSpaceClient(clientId: string): boolean {
  return !clientId.startsWith(AWAY_PREFIX);
}
