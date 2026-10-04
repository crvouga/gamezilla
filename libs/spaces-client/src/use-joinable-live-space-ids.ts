import { useMyId } from '@libs/auth-client/use-current-user';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

import { sharedLiveSpaceIdsSql } from './my-live-space-seat-sql';

/** Live spaces the viewer can join: host, spaces_users ACL, or a friend's live space. */
export function useJoinableLiveSpaceIds(): {
  readonly spaceIds: Accessor<readonly string[]>;
  readonly isLoading: Accessor<boolean>;
} {
  const memberId = useMyId();
  const enabled = createMemo(() => memberId().length > 0);
  const query = createQuery(() =>
    sharedLiveSpaceIdsSql({ memberId: memberId() })
  );
  const spaceIds = createMemo(() =>
    enabled() ? query.rows().map((r) => r.id) : []
  );
  const loading = createMemo(() => enabled() && query.isLoading());
  return {
    spaceIds,
    isLoading: loading,
  };
}
