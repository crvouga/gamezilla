import { readAttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { contentClient } from './content-actions';
import { selectContentDocument } from './content-selection';
import type { ContentHarness } from './content-system';

export function disconnectContentDevice(
  s: ContentHarness,
  clientId: string
): void {
  s.net(clientId, 'all').set('down');
  contentClient(s, clientId).online(false);
  s.offline.add(clientId);
}

export const contentDeviceOffline = defineAction({
  name: 'contentDeviceOffline',
  act: disconnectContentDevice,
});
export const contentDeviceOnline = defineAction({
  name: 'contentDeviceOnline',
  act: async (s: ContentHarness, clientId: string) => {
    s.net(clientId, 'all').set('ok');
    s.offline.delete(clientId);
    contentClient(s, clientId).online(true);
    await contentClient(s, clientId).connect();
  },
});

export const reopenContentDevice = defineAction({
  name: 'reopenContentDevice',
  act: async (s: ContentHarness, clientId: string) => {
    const documentId = s.editors.get(clientId)?.documentId;
    const selected = s.playSelections.get(clientId);
    s.editors.delete(clientId);
    s.playSelections.delete(clientId);
    await s.node(clientId).restart({ preserveLocalDb: true });
    if (s.offline.has(clientId)) contentClient(s, clientId).online(false);
    if (documentId !== undefined)
      await selectContentDocument(s, clientId, documentId);
    if (selected !== undefined) {
      const library = await readAttemptLibrary(contentClient(s, clientId).db);
      const attempt = library.attempts.find(
        (entry) => entry.id === selected.attemptId
      );
      if (attempt !== undefined)
        s.playSelections.set(clientId, {
          attemptId: attempt.id,
          positionId: attempt.current_position_id,
        });
    }
  },
});

export const OFFLINE_ACTIONS = [
  contentDeviceOffline,
  contentDeviceOnline,
  reopenContentDevice,
] as const;
