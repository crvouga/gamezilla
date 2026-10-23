import {
  type ContentLibrary,
  contentDraftCopies,
  discoverContent,
  readContentLibrary,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import { contentClient } from './content-actions';
import type { ContentHarness } from './content-system';

export async function packEditionOrders(
  s: ContentHarness
): Promise<readonly string[]> {
  const library = await readContentLibrary(contentClient(s, 'alice:phone').db);
  const documentId = s.selectedPacks.get('alice:phone');
  return library.revisions
    .filter((edition) => edition.document_id === documentId)
    .sort((a, b) => a.edition - b.edition)
    .map((edition) => packTitles(library, edition.definition).join(', '));
}

function packTitles(
  library: ContentLibrary,
  definition: string
): readonly string[] {
  return (
    decodePackDefinition(definition)?.items.map(
      (item) =>
        library.revisions.find((edition) => edition.id === item.revisionId)
          ?.title ??
        library.drafts.find((draft) => draft.document_id === item.puzzleId)
          ?.title ??
        'Unavailable puzzle'
    ) ?? []
  );
}

export async function workingPackTitles(
  s: ContentHarness,
  clientId: string
): Promise<readonly string[]> {
  const library = await readContentLibrary(contentClient(s, clientId).db);
  const draft = workingContentDraft(
    library,
    s.selectedPacks.get(clientId) ?? ''
  );
  return draft === null ? [] : packTitles(library, draft.definition);
}

export async function publishedPackTitles(
  s: ContentHarness,
  title: string
): Promise<readonly string[] | null> {
  const library = await readContentLibrary(contentClient(s, 'bob:phone').db);
  const pack = discoverContent(library, 'counting').find(
    (edition) => edition.kind === 'pack' && edition.title === title
  );
  return pack === undefined ? null : packTitles(library, pack.definition);
}

export async function packDraftDetails(
  s: ContentHarness
): Promise<{ readonly title: string; readonly description: string } | null> {
  const library = await readContentLibrary(contentClient(s, 'alice:phone').db);
  const draft = workingContentDraft(
    library,
    s.selectedPacks.get('alice:phone') ?? ''
  );
  return draft === null
    ? null
    : { title: draft.title, description: draft.description };
}

export async function keptPackOrders(
  s: ContentHarness
): Promise<readonly (readonly string[])[]> {
  const library = await readContentLibrary(contentClient(s, 'alice:phone').db);
  return contentDraftCopies(
    library,
    s.selectedPacks.get('alice:phone') ?? ''
  ).map((draft) => packTitles(library, draft.definition));
}

export async function workingPackOrder(
  s: ContentHarness,
  clientId: string
): Promise<string> {
  return (await workingPackTitles(s, clientId)).join(', ');
}

export async function publishedPackOrder(
  s: ContentHarness,
  title: string
): Promise<string | null> {
  return (await publishedPackTitles(s, title))?.join(', ') ?? null;
}

export async function keptPackOrderChoices(
  s: ContentHarness
): Promise<readonly string[]> {
  return (await keptPackOrders(s)).map((titles) => titles.join(', '));
}
