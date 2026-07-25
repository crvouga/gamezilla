import { runWrite } from '@pkgs/write/shared/run-write';
import {
  isWriteFailure,
  type WriteFailure,
} from '@pkgs/write/shared/write-result';
import type { WriteContext } from '@pkgs/write/shared/write-context';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { joinSpaceWrite } from '../../shared/join-space/join-space-write';
import { SpacesError, type SpacesErrorCode } from '../../shared/spaces-errors';

export type JoinSpaceServerInput = {
  readonly spaceId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly profileId: string;
  readonly inviteToken: string | null;
};

const SPACE_ERROR_CODES = new Set<string>([
  'SPACE_NOT_FOUND',
  'SPACE_ENDED',
  'SPACE_FORBIDDEN',
  'SPACE_NOT_SIGNED_IN',
  'SPACE_HOST_ALREADY_MEMBER',
  'SPACE_INVITE_INVALID',
  'SPACE_INVITE_EXPIRED',
  'SPACE_INVITE_REVOKED',
  'SPACE_INVITE_EXHAUSTED',
  'SPACE_VISIBILITY_DENIED',
  'SPACE_INVALID_INPUT',
]);

function writeContextFromJoinInput(input: JoinSpaceServerInput): WriteContext {
  return {
    deviceId: input.deviceId,
    accountId: input.accountId,
    myId: input.profileId,
    subjectId: input.accountId ?? input.deviceId,
    isAnonymous: input.accountId === null,
    memberOfSpaceIds: [],
  };
}

function writeFailureToSpacesError(failure: WriteFailure): SpacesError {
  if (failure.code === 'INVALID_INPUT') {
    return new SpacesError('SPACE_INVALID_INPUT', failure.message);
  }
  if (SPACE_ERROR_CODES.has(failure.code)) {
    return new SpacesError(failure.code as SpacesErrorCode, failure.message);
  }
  return new SpacesError('SPACE_FORBIDDEN', failure.message);
}

/**
 * Server join entry — same {@link joinSpaceWrite} as client `runClientWrite`.
 * Used by inbox accept; the client join path is local-first via PowerSync.
 */
export async function joinSpaceServer(
  sql: SqlClient,
  input: JoinSpaceServerInput
): Promise<void> {
  const result = await runWrite({
    write: joinSpaceWrite,
    ctx: writeContextFromJoinInput(input),
    rawInput: {
      spaceId: input.spaceId,
      inviteToken: input.inviteToken,
    },
    sql,
    mode: 'full',
  });
  if (isWriteFailure(result)) {
    throw writeFailureToSpacesError(result);
  }
}
