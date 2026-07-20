/** PowerSync on-demand stream that hydrates a join/deep-link target. */
export const SPACE_JOIN_STREAM = 'space_join';

export type SpaceJoinStreamParams = {
  readonly space_id: string;
  readonly invite_token: string;
};

export function spaceJoinStreamParams(args: {
  readonly spaceId: string;
  readonly inviteToken?: string | null;
}): SpaceJoinStreamParams {
  const token = args.inviteToken ?? '';
  return {
    space_id: args.spaceId,
    invite_token: token.length > 0 ? token : '',
  };
}
