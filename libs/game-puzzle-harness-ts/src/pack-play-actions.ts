import { readAttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import {
  discoverContent,
  readContentLibrary,
} from '@libs/game-puzzle-shared-ts/content-library';
import { packProgress } from '@libs/game-puzzle-shared-ts/pack-progress';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { startAttemptFor } from './attempt-actions';
import { contentClient } from './content-actions';
import type { ContentHarness } from './content-system';

export async function openPackFor(
  s: ContentHarness,
  clientId: string,
  title: string
): Promise<void> {
  const content = await readContentLibrary(contentClient(s, clientId).db);
  const pack = discoverContent(content, 'counting').find(
    (edition) => edition.kind === 'pack' && edition.title === title
  );
  if (pack === undefined) throw new Error('Choose an available pack');
  s.packViews.set(clientId, pack.id);
}

export async function startPackPuzzleFor(
  s: ContentHarness,
  clientId: string,
  title: string
): Promise<void> {
  const content = await readContentLibrary(contentClient(s, clientId).db);
  const play = await readAttemptLibrary(contentClient(s, clientId).db);
  const packRevisionId = s.packViews.get(clientId);
  const progress =
    packRevisionId === undefined
      ? null
      : packProgress({ content, play, packRevisionId });
  const item = progress?.items.find((entry) => entry.title === title);
  if (item === undefined || packRevisionId === undefined)
    throw new Error('Choose a puzzle from the opened pack');
  await startAttemptFor(s, clientId, {
    title,
    revisionId: item.revisionId,
    packRevisionId,
  });
}

export const openPublishedPack = defineAction({
  name: 'openPublishedPack',
  act: openPackFor,
});
export const startPublishedPackPuzzle = defineAction({
  name: 'startPublishedPackPuzzle',
  act: async (
    s: ContentHarness,
    clientId: string,
    title: string,
    pack: string
  ) => {
    await openPackFor(s, clientId, pack);
    await startPackPuzzleFor(s, clientId, title);
  },
});

export const continuePublishedPack = defineAction({
  name: 'continuePublishedPack',
  act: async (s: ContentHarness, title: string) => {
    const clientId = 'bob:phone';
    await openPackFor(s, clientId, title);
    const content = await readContentLibrary(contentClient(s, clientId).db);
    const play = await readAttemptLibrary(contentClient(s, clientId).db);
    const packRevisionId = s.packViews.get(clientId)!;
    const next = packProgress({ content, play, packRevisionId })?.next;
    if (next == null) return;
    const attempt = play.attempts.find((entry) => entry.id === next.attemptId);
    if (attempt !== undefined)
      s.playSelections.set(clientId, {
        attemptId: attempt.id,
        positionId: attempt.current_position_id,
      });
    else await startPackPuzzleFor(s, clientId, next.title);
  },
});

export const PACK_PLAY_ACTIONS = [
  openPublishedPack,
  startPublishedPackPuzzle,
  continuePublishedPack,
] as const;
