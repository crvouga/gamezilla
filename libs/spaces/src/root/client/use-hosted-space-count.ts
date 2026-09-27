import { useMyId } from '@libs/auth/public/use-current-user';
import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo } from 'solid-js';

import { liveHostedSpacesCountSql } from '../../shared/space/hosted-spaces-sql';

/** How many live spaces the viewer hosts (what the hosting limit counts). */
export function useHostedSpaceCount(): Accessor<number> {
  const myId = useMyId();
  const query = createQuery(() =>
    liveHostedSpacesCountSql({ memberId: myId(), exceptSpaceId: null })
  );
  return createMemo(() => Number(query.rows()[0]?.hosted ?? 0));
}
