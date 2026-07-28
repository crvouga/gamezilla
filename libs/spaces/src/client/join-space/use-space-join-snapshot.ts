import {
  useMyAccountId,
  useMyDeviceId,
} from '@libs/auth/client/use-current-user';
import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { sql, ident } from '@pkgs/sql';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { useSyncEngineSubscriptions } from '@pkgs/sync-engine/client/use-sync-engine-subscriptions';
import { useMemo } from 'react';

import {
  resolveSpaceJoinSnapshot,
  type SpaceJoinLocalRow,
  type SpaceJoinSnapshot,
} from '../../shared/join-space/resolve-space-join-snapshot';
import {
  SPACE_JOIN_STREAM,
  spaceJoinStreamParams,
} from '../../shared/join-space/space-join-stream';
import {
  useAreAccountsFriendsLocal,
  useHasValidLocalInvite,
} from './use-space-join-access-flags';

export type {
  SpaceJoinSnapshot,
  SpaceJoinSnapshotStatus,
} from '../../shared/join-space/resolve-space-join-snapshot';

function useSpaceJoinStreamReady(
  spaceId: string,
  inviteToken: string | null
): boolean {
  const enabled = spaceId.length > 0;
  const specs = useMemo(
    () =>
      enabled
        ? [
            {
              stream: SPACE_JOIN_STREAM,
              params: spaceJoinStreamParams({
                spaceId,
                inviteToken,
              }),
            },
          ]
        : [],
    [enabled, spaceId, inviteToken]
  );
  const { ready } = useSyncEngineSubscriptions(specs);
  return ready;
}

export function useSpaceJoinSnapshot(
  spaceId: string,
  inviteToken?: string | null
): SpaceJoinSnapshot {
  const enabled = spaceId.length > 0;
  const token = inviteToken ?? null;
  const streamReady = useSpaceJoinStreamReady(spaceId, token);
  const viewerAccountId = useMyAccountId();
  const viewerDeviceId = useMyDeviceId();
  const spaceColumns = sql`SELECT ${ident(SpaceCol.hostId)} AS host_id,
                ${ident(SpaceCol.hostMemberId)} AS host_member_id,
                ${ident(SpaceCol.hostAccountId)} AS host_account_id,
                ${ident(SpaceCol.endedAt)} AS ended_at,
                ${ident(SpaceCol.visibility)} AS visibility
         FROM ${ident(SPACES_TABLE.tableName)}`;
  const { row, isLoading } = useWatchOne<SpaceJoinLocalRow>(
    enabled
      ? sql`${spaceColumns} WHERE ${ident(SpaceCol.id)} = ${spaceId}`
      : sql`${spaceColumns} WHERE 0`
  );
  const hasValidInvite = useHasValidLocalInvite(spaceId, token);
  const isFriendOfHost = useAreAccountsFriendsLocal(
    viewerAccountId,
    row?.host_account_id ?? null
  );

  return useMemo(
    () =>
      resolveSpaceJoinSnapshot({
        enabled,
        streamReady,
        rowLoading: isLoading,
        row,
        hasValidInvite,
        isFriendOfHost,
        viewerAccountId,
        viewerDeviceId,
      }),
    [
      enabled,
      streamReady,
      isLoading,
      row,
      hasValidInvite,
      isFriendOfHost,
      viewerAccountId,
      viewerDeviceId,
    ]
  );
}
