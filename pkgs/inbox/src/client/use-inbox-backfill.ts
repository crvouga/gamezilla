import { createLogger } from '@pkgs/logger/logger';
import { useEffect, useRef } from 'react';

import { backfillInboxRemote } from './inbox-actions';
import { useInboxShell } from './inbox-provider-registry';

const log = createLogger({ name: 'inbox-backfill' });

function logBackfillFailure(error: unknown): void {
  log.error('backfill failed', {
    error: error instanceof Error ? error.message : String(error),
  });
}

export function useInboxBackfill(): void {
  const { isSignedIn, isAuthReady, deps } = useInboxShell();
  const started = useRef(false);

  useEffect(() => {
    if (!isSignedIn) {
      started.current = false;
      return;
    }
    if (!isAuthReady || started.current) return;
    started.current = true;
    void backfillInboxRemote(deps).catch((error: unknown) => {
      started.current = false;
      logBackfillFailure(error);
    });
  }, [deps, isAuthReady, isSignedIn]);
}
