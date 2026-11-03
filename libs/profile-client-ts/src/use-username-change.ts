import { claimUsernameMutation } from '@libs/profile-shared-ts/claim-username-mutation';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useMutationFeedback } from '@pkgs/sync-engine-client-ts/use-mutation-feedback';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';
import type { UsernameChange } from './username-change-feedback-view';

/** The outcome remains visible after leaving the editor or reopening the app. */
export function useUsernameChange(): Accessor<UsernameChange | null> {
  const feedback = useMutationFeedback(claimUsernameMutation.name);
  const engine = useSyncEngine();
  return createMemo((): UsernameChange | null => {
    const current = feedback();
    if (current?.status === 'pending') {
      return { status: 'pending', online: engine.status().online };
    }
    if (current?.status === 'rejected') {
      return { status: 'rejected', code: current.code ?? '' };
    }
    return null;
  });
}
