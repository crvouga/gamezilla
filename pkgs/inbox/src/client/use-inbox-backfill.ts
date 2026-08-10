import { useIo } from '@pkgs/io';
import { createLogger } from '@pkgs/logger/logger';
import { useEffect, useMemo, useRef } from 'react';

import { backfillInboxRemote } from './inbox-actions';
import { useInboxShell } from './inbox-provider-registry';

export function useInboxBackfill(): void {
  const { isSignedIn, isAuthReady, deps } = useInboxShell();
  const io = useIo();
  const log = useMemo(
    () => createLogger({ name: 'inbox-backfill', now: io.clock.now }),
    [io.clock.now]
  );
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
      log.error('backfill failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, [deps, isAuthReady, isSignedIn, log]);
}
