import {
  useMyAccountId,
  useMyDeviceId,
} from '@libs/auth/client/use-current-user';
import {
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
} from '@libs/db/shared/space-tables';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';
// #region agent log
import { useEffect } from 'react';
// #endregion

import type { LiveSpaceSection } from './live-space-section';

type SpaceIdRow = { readonly id: string };

export type { LiveSpaceSection };

function usePublicLiveSpaceIds(): {
  readonly spaceIds: readonly string[];
  readonly isLoading: boolean;
} {
  const { rows, isLoading } = useWatchQuery<SpaceIdRow>(
    `SELECT ${SpaceCol.id} AS id FROM ${SPACES_TABLE.tableName}
     WHERE ${SpaceCol.endedAt} IS NULL
       AND ${SpaceCol.visibility} = 'public'
     ORDER BY ${SpaceCol.createdAt} DESC`
  );
  return { spaceIds: rows.map((r) => r.id), isLoading };
}

/**
 * Friends-visible live spaces plus spaces on this account/device, newest-first.
 * Deduped by SQL (single SELECT).
 */
function useFriendsLiveSpaceIds(): {
  readonly spaceIds: readonly string[];
  readonly isLoading: boolean;
} {
  const deviceId = useMyDeviceId();
  const accountId = useMyAccountId();
  const hasAccount = accountId !== null && accountId.length > 0;
  const { rows, isLoading } = useWatchQuery<SpaceIdRow>(
    hasAccount
      ? `SELECT ${SpaceCol.id} AS id FROM ${SPACES_TABLE.tableName}
         WHERE ${SpaceCol.endedAt} IS NULL
           AND (
             ${SpaceCol.visibility} = 'friends'
             OR ${SpaceCol.hostMemberId} = ?
             OR ${SpaceCol.hostAccountId} = ?
             OR ${SpaceCol.id} IN (
               SELECT ${SpaceMembershipCol.spaceId}
               FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
               WHERE ${SpaceMembershipCol.leftAt} IS NULL
                 AND (
                   ${SpaceMembershipCol.memberId} = ?
                   OR ${SpaceMembershipCol.profileId} = ?
                 )
             )
           )
         ORDER BY ${SpaceCol.createdAt} DESC`
      : `SELECT ${SpaceCol.id} AS id FROM ${SPACES_TABLE.tableName}
         WHERE ${SpaceCol.endedAt} IS NULL
           AND (
             ${SpaceCol.visibility} = 'friends'
             OR ${SpaceCol.hostMemberId} = ?
             OR ${SpaceCol.id} IN (
               SELECT ${SpaceMembershipCol.spaceId}
               FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
               WHERE ${SpaceMembershipCol.leftAt} IS NULL
                 AND ${SpaceMembershipCol.memberId} = ?
             )
           )
         ORDER BY ${SpaceCol.createdAt} DESC`,
    hasAccount && accountId !== null
      ? [accountId, accountId, accountId, accountId]
      : [deviceId, deviceId]
  );
  return { spaceIds: rows.map((r) => r.id), isLoading };
}

// #region agent log
function useDebugPhantomSpaces(
  section: LiveSpaceSection,
  spaceIds: readonly string[],
  isLoading: boolean
): void {
  const { rows: allSpaceRows } = useWatchQuery<Record<string, unknown>>(
    `SELECT * FROM ${SPACES_TABLE.tableName} ORDER BY ${SpaceCol.createdAt} DESC LIMIT 20`
  );
  const idsKey = JSON.stringify(spaceIds);
  const allRowsKey = JSON.stringify(allSpaceRows);
  useEffect(() => {
    fetch(
      'http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '11af44',
        },
        body: JSON.stringify({
          sessionId: '11af44',
          hypothesisId: 'C,D',
          location: 'use-live-space-ids-by-section.ts:useDebugPhantomSpaces',
          message: 'section ids + all local space rows',
          data: {
            section,
            renderedSpaceIds: spaceIds,
            isLoading,
            allLocalSpaceRows: allSpaceRows,
          },
          timestamp: Date.now(),
        }),
      }
    ).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debug instrumentation keyed by serialized values
  }, [section, idsKey, allRowsKey, isLoading]);
}
// #endregion

/**
 * Live spaces for one lobby section, newest-first.
 */
export function useLiveSpaceIdsBySection(section: LiveSpaceSection): {
  readonly spaceIds: readonly string[];
  readonly isLoading: boolean;
} {
  const publicIds = usePublicLiveSpaceIds();
  const friendsIds = useFriendsLiveSpaceIds();
  const active = section === 'public' ? publicIds : friendsIds;
  // #region agent log
  useDebugPhantomSpaces(section, active.spaceIds, active.isLoading);
  // #endregion
  return active;
}
