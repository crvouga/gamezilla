import { currentAttemptState } from '@libs/game-puzzle-shared-ts/attempt-history';
import {
  type AttemptLibrary,
  readAttemptLibrary,
} from '@libs/game-puzzle-shared-ts/attempt-library';
import { decodeAttemptHistory } from '@libs/game-puzzle-shared-ts/attempt-types';
import {
  bundledContent,
  withBundledContent,
} from '@libs/game-puzzle-shared-ts/bundled-content';
import {
  type ContentLibrary,
  discoverContent,
  readContentLibrary,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import type { ContentRevision } from '@libs/game-puzzle-shared-ts/content-types';
import { packProgress } from '@libs/game-puzzle-shared-ts/pack-progress';
import { contentClient } from './content-actions';
import type { ContentHarness } from './content-system';

/**
 * What a game's harness reads from one device, as its screens see it: the
 * game's content (shipped editions included), saved play, positions and pack
 * progress. Games read through these rather than the platform's storage.
 */
export async function contentOnDevice(
  s: ContentHarness,
  clientId: string
): Promise<ContentLibrary> {
  return withBundledContent(
    await readContentLibrary(contentClient(s, clientId).db),
    s.game.id,
    s.content
  );
}

export function playOnDevice(
  s: ContentHarness,
  clientId: string
): Promise<AttemptLibrary> {
  return readAttemptLibrary(contentClient(s, clientId).db);
}

export async function workingDefinitionOnDevice(
  s: ContentHarness,
  clientId: string,
  documentId: string
): Promise<string | null> {
  return (
    workingContentDraft(await contentOnDevice(s, clientId), documentId)
      ?.definition ?? null
  );
}

/** The editions people can discover for the game on the device. */
export async function discoveredOnDevice(
  s: ContentHarness,
  clientId: string
): Promise<readonly ContentRevision[]> {
  return discoverContent(await contentOnDevice(s, clientId), s.game.id);
}

/** An attempt's played definition and its current saved state. */
export async function attemptOnDevice(
  s: ContentHarness,
  clientId: string,
  attemptId: string
): Promise<{
  readonly definition: string;
  readonly positionId: string;
  readonly state: string;
} | null> {
  const play = await playOnDevice(s, clientId);
  const attempt = play.attempts.find((entry) => entry.id === attemptId);
  const saved = play.positions.find(
    (entry) => entry.id === attempt?.current_position_id
  );
  const library = await contentOnDevice(s, clientId);
  const source =
    attempt?.mode === 'playtest'
      ? library.drafts.find((draft) => draft.id === attempt.source_id)
      : library.revisions.find((edition) => edition.id === attempt?.source_id);
  const history = decodeAttemptHistory(saved?.history ?? '');
  if (saved === undefined || source === undefined || history === null)
    return null;
  return {
    definition: source.definition,
    positionId: saved.id,
    state: currentAttemptState(history),
  };
}

export async function packProgressOnDevice(
  s: ContentHarness,
  clientId: string,
  packTitle: string
) {
  const content = await contentOnDevice(s, clientId);
  const pack = content.revisions.find(
    (edition) => edition.kind === 'pack' && edition.title === packTitle
  );
  return pack === undefined
    ? null
    : packProgress({
        content,
        play: await playOnDevice(s, clientId),
        packRevisionId: pack.id,
      });
}

/** The game's shipped pack editions in this run's rules, in pack order. */
export function shippedEditions(s: ContentHarness) {
  return bundledContent(s.game.id, s.content);
}
