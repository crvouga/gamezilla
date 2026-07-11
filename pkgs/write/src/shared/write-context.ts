export type WriteContext = {
  /** JWT subject — account id when signed in, else device id. */
  readonly subjectId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  /** Author id for ownership checks: accountId ?? deviceId. */
  readonly myId: string;
  readonly isAnonymous: boolean;
  readonly memberOfSpaceIds: readonly string[];
};
