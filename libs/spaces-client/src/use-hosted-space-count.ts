import { useMyId } from '@libs/auth-client/use-current-user';
import { liveHostedSpacesCountSql } from '@libs/spaces-shared/hosted-spaces-sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

/** How many live spaces the viewer hosts (what the hosting limit counts). */
export function useHostedSpaceCount(): Accessor<number> {
  const myId = useMyId();
  const query = createQuery(() =>
    liveHostedSpacesCountSql({ memberId: myId(), exceptSpaceId: null })
  );
  return createMemo(() => Number(query.rows()[0]?.hosted ?? 0));
}
