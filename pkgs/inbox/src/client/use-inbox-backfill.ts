import { useEffect, useRef } from 'react';

import { backfillInboxRemote } from './inbox-actions';
import { useInboxShell } from './inbox-provider-registry';

export function useInboxBackfill(): void {
  const { isSignedIn, deps } = useInboxShell();
  const started = useRef(false);

  useEffect(() => {
    if (!isSignedIn || started.current) return;
    started.current = true;
    void backfillInboxRemote(deps).catch(() => {});
  }, [deps, isSignedIn]);
}
