/**
 * Prefer the host profile username; when that is empty and this device/account
 * hosts the space, fall back to the viewer's username.
 */
export function resolveSpaceTitleUsername(args: {
  readonly hostUsername: string | null;
  readonly myUsername: string | null;
  readonly hostProfileId: string;
  readonly myId: string;
  readonly hostId: string | null;
  readonly myDeviceId: string;
}): string | null {
  if (args.hostUsername !== null && args.hostUsername.length > 0) {
    return args.hostUsername;
  }
  const isOwnHost =
    (args.hostProfileId.length > 0 && args.hostProfileId === args.myId) ||
    (args.hostId !== null &&
      args.hostId.length > 0 &&
      args.hostId === args.myDeviceId);
  if (!isOwnHost) {
    return args.hostUsername;
  }
  if (args.myUsername !== null && args.myUsername.length > 0) {
    return args.myUsername;
  }
  return args.hostUsername;
}
