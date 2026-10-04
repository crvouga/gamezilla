/**
 * A host looking at their own live space belongs inside it. End, the games,
 * and ending a leftover all live there. Someone who does not host it still
 * sees Join. An ended space is not reopened.
 */
export function shouldEnterOwnLiveSpace(args: {
  readonly isHost: boolean;
  readonly spaceEnded: boolean;
}): boolean {
  return args.isHost && !args.spaceEnded;
}
