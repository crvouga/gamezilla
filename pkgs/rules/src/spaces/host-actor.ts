/** Duplicated from spaces participation policy — pkgs must not import @libs/*. */

export function isHostMember(args: {
  readonly hostMemberId: string;
  readonly memberId: string;
}): boolean {
  const host = args.hostMemberId ?? '';
  const member = args.memberId ?? '';
  return host.length > 0 && member.length > 0 && host === member;
}

function nonEmptyEqual(a: string, b: string): boolean {
  return a.length > 0 && b.length > 0 && a === b;
}

/**
 * Whether the actor may act as space owner, including identity-drift cases.
 */
export function isSpaceHostActor(args: {
  readonly hostId: string;
  readonly hostMemberId: string;
  readonly hostAccountId: string | null;
  readonly memberId: string;
  readonly accountId: string | null;
  readonly deviceId: string;
}): boolean {
  if (
    isHostMember({
      hostMemberId: args.hostMemberId,
      memberId: args.memberId,
    })
  ) {
    return true;
  }
  if (nonEmptyEqual(args.hostId ?? '', args.deviceId ?? '')) {
    return true;
  }
  return nonEmptyEqual(args.hostAccountId ?? '', args.accountId ?? '');
}

export function decideEndSpace(args: {
  readonly isHostActor: boolean;
}): { readonly allowed: true } | { readonly allowed: false } {
  if (!args.isHostActor) {
    return { allowed: false };
  }
  return { allowed: true };
}
