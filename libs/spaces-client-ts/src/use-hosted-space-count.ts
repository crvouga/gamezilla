import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { liveHostedSpacesCountSql } from '@libs/spaces-shared-ts/hosted-spaces-sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

/** How many live spaces the viewer hosts (what the hosting limit counts). */
export function useHostedSpaceCount(): {
  readonly count: Accessor<number>;
  readonly isLoading: Accessor<boolean>;
} {
  const myId = useMyId();
  const query = createQuery(() =>
    liveHostedSpacesCountSql({ memberId: myId(), exceptSpaceId: null })
  );
  return {
    count: createMemo(() => Number(query.rows()[0]?.hosted ?? 0)),
    isLoading: query.isLoading,
  };
}
