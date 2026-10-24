import {
  discoverContent,
  readContentLibrary,
} from '@libs/game-puzzle-shared-ts/content-library';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import {
  contentClient,
  saveContentEditor,
  sendContentMutation,
} from './content-actions';
import { publishCurrentContent } from './content-publication-actions';
import { selectContentDocument, selectPackEditor } from './content-selection';
import { waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';
import {
  connectContentDevice,
  disconnectContentDevice,
} from './offline-actions';
import { arrangePackFor } from './pack-fixtures';

type RecoveryPack = { readonly pack: string; readonly titles: string };

async function arrangeRecoveryPack(
  s: ContentHarness,
  args: RecoveryPack
): Promise<void> {
  const titles = args.titles.split(', ');
  await arrangePackFor(s, { title: args.pack, titles });
  for (const clientId of ['alice:phone', 'alice:tablet', 'bob:phone'])
    await waitForContent(s, async () => {
      const published = discoverContent(
        await readContentLibrary(contentClient(s, clientId).db),
        'counting'
      );
      return titles.every((title) =>
        published.some((entry) => entry.title === title)
      );
    });
}

async function arrangeOfflinePublication(
  s: ContentHarness,
  args: RecoveryPack
): Promise<void> {
  await arrangeRecoveryPack(s, args);
  disconnectContentDevice(s, 'alice:phone');
  await publishCurrentContent(s, 'alice:phone');
}

export const chooseOfflinePackPublication = defineAction({
  name: 'chooseOfflinePackPublication',
  act: arrangeOfflinePublication,
});

export async function withdrawChosenPuzzleFor(
  s: ContentHarness,
  title: string
): Promise<void> {
  const documentId = s.documents.get(title);
  if (documentId === undefined)
    throw new Error('Choose a puzzle from the pack');
  await sendContentMutation(s, 'alice:tablet', 'withdrawPuzzleContent', {
    documentId,
  });
}

export const withdrawChosenRecoveryPuzzle = defineAction({
  name: 'withdrawChosenRecoveryPuzzle',
  act: withdrawChosenPuzzleFor,
});

export const arrangeRefusedPackPublication = defineAction({
  name: 'arrangeRefusedPackPublication',
  act: async (
    s: ContentHarness,
    args: RecoveryPack & { readonly withdrawn: string }
  ) => {
    await arrangeOfflinePublication(s, args);
    await withdrawChosenPuzzleFor(s, args.withdrawn);
    const id = s.selectedPacks.get('alice:phone') ?? '';
    const result = s.publicationResults.get(id);
    if (result?.ok !== true)
      throw new Error(
        `The offline publication was not accepted locally: ${JSON.stringify(result)}`
      );
    await connectContentDevice(s, 'alice:phone');
    await waitForContent(
      s,
      async () =>
        (await contentClient(s, 'alice:phone').engine.mutationOutcome(
          result.mutationId
        )) === 'rejected'
    );
  },
});

export async function prepareChosenPuzzleFor(
  s: ContentHarness,
  clientId: string,
  title: string
): Promise<void> {
  const id = s.documents.get(title);
  if (id === undefined) throw new Error('Choose a puzzle already in the pack');
  await selectContentDocument(s, clientId, id);
  await saveContentEditor(s, clientId);
  const result = s.lastResult.get(clientId);
  if (result?.ok !== true)
    throw new Error(
      `The chosen puzzle's fresh draft was refused: ${JSON.stringify(result)}`
    );
  s.selectedPuzzles.set(clientId, id);
}

export const prepareChosenRecoveryPuzzle = defineAction({
  name: 'prepareChosenRecoveryPuzzle',
  act: (s: ContentHarness, title: string) =>
    prepareChosenPuzzleFor(s, 'alice:phone', title),
});

async function republishChosenPuzzleFor(
  s: ContentHarness,
  title: string
): Promise<void> {
  await prepareChosenPuzzleFor(s, 'alice:tablet', title);
  await publishCurrentContent(s, 'alice:tablet');
  const result = s.lastResult.get('alice:tablet');
  if (result?.ok !== true)
    throw new Error(
      `The chosen puzzle's republication was refused: ${JSON.stringify(result)}`
    );
}

export const republishRecoveryPuzzle = defineAction({
  name: 'republishRecoveryPuzzle',
  act: republishChosenPuzzleFor,
});

export const republishChosenRecoveryPuzzle = defineAction({
  name: 'republishChosenRecoveryPuzzle',
  act: async (s: ContentHarness, title: string) => {
    await republishChosenPuzzleFor(s, title);
    const id = s.documents.get(title);
    if (!s.offline.has('alice:phone'))
      await waitForContent(s, async () =>
        discoverContent(
          await readContentLibrary(contentClient(s, 'alice:phone').db),
          'counting'
        ).some((edition) => edition.document_id === id)
      );
  },
});

export const setupPublicationRecovery = defineAction({
  name: 'setupPublicationRecovery',
  act: (s: ContentHarness) =>
    arrangeRecoveryPack(s, {
      pack: 'Rivers',
      titles: 'River, Valley',
    }),
});

export const chooseRecoveryPublication = defineAction({
  name: 'chooseRecoveryPublication',
  act: async (s: ContentHarness) => {
    await selectPackEditor(s, 'alice:phone');
    await publishCurrentContent(s, 'alice:phone');
  },
});

export const PUBLICATION_RECOVERY_ACTIONS = [
  chooseOfflinePackPublication,
  withdrawChosenRecoveryPuzzle,
  arrangeRefusedPackPublication,
  prepareChosenRecoveryPuzzle,
  republishChosenRecoveryPuzzle,
  republishRecoveryPuzzle,
  setupPublicationRecovery,
  chooseRecoveryPublication,
] as const;
