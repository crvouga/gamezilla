import { readAttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import { readContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import { packProgress } from '@libs/game-puzzle-shared-ts/pack-progress';
import { currentAttemptView } from './attempt-observations';
import { contentClient } from './content-actions';
import type { ContentHarness } from './content-system';

export async function rememberedEditionKept(
  s: ContentHarness,
  clientId: string
): Promise<boolean> {
  const view = await currentAttemptView(s, clientId);
  return view !== null && view.editionId === s.rememberedEditions.get(clientId);
}

export async function namedPackProgress(
  s: ContentHarness,
  clientId: string,
  title: string
) {
  const content = await readContentLibrary(contentClient(s, clientId).db);
  const selected = content.revisions.find(
    (edition) =>
      edition.id === s.packViews.get(clientId) && edition.title === title
  );
  const pack =
    selected ??
    content.revisions
      .filter((edition) => edition.kind === 'pack' && edition.title === title)
      .toSorted((a, b) => b.edition - a.edition)[0];
  if (pack === undefined) return null;
  return packProgress({
    content,
    play: await readAttemptLibrary(contentClient(s, clientId).db),
    packRevisionId: pack.id,
  });
}

export async function currentPackProgress(s: ContentHarness, clientId: string) {
  const packRevisionId = s.packViews.get(clientId);
  if (packRevisionId === undefined) return null;
  return packProgress({
    content: await readContentLibrary(contentClient(s, clientId).db),
    play: await readAttemptLibrary(contentClient(s, clientId).db),
    packRevisionId,
  });
}

export async function rememberedPositionRestored(
  s: ContentHarness,
  clientId: string
): Promise<boolean> {
  const view = await currentAttemptView(s, clientId);
  return (
    view !== null &&
    view.state === s.rememberedStates.get(clientId) &&
    view.editionId === s.rememberedEditions.get(clientId)
  );
}
