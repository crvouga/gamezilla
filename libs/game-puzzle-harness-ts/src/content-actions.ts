import {
  readContentLibrary,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import {
  type ContentBody,
  contentBody,
} from '@libs/game-puzzle-shared-ts/content-types';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import type { HarnessClient } from '@pkgs/sync-engine-harness-ts/client';
import { waitUntil } from '@pkgs/sync-engine-harness-ts/wait-until';
import type { MutateResult } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { ContentEditor, ContentHarness } from './content-system';

export function contentClient(s: ContentHarness, id: string): HarnessClient {
  const client = s.clients.get(id);
  if (client === undefined) throw new Error(`Missing content device: ${id}`);
  return client;
}

/** Record actual caller results, including the publication's document scope. */
export function recordContentResult(
  s: ContentHarness,
  clientId: string,
  write: { readonly name: string; readonly args: unknown },
  result: MutateResult
): void {
  s.lastResult.set(clientId, result);
  const args = write.args;
  if (
    write.name === 'publishPuzzleContent' &&
    typeof args === 'object' &&
    args !== null &&
    'documentId' in args &&
    typeof args.documentId === 'string'
  )
    s.publicationResults.set(args.documentId, result);
}

export async function sendContentMutation(
  s: ContentHarness,
  clientId: string,
  name: string,
  args: unknown
): Promise<boolean> {
  const client = contentClient(s, clientId);
  const definition = s.runtime.app.pack.mutationRegistry[name];
  if (definition === undefined)
    throw new Error(`Unknown content mutation: ${name}`);
  const result = await client.mutate(definition, args);
  recordContentResult(s, clientId, { name, args }, result);
  if (!result.ok || s.offline.has(clientId)) return result.ok;
  const outcome = client.outcome(result.mutationId);
  await waitUntil(
    {
      seed: s.seed,
      scheduler: s.session.scheduler.underlying,
      network: s.session.network,
    },
    outcome
  );
  if ((await outcome) === 'rejected') {
    const rejected = (await client.rejections()).find(
      (entry) => entry.mutationId === result.mutationId
    );
    if (rejected === undefined)
      throw new Error('Missing content mutation rejection');
    s.lastResult.set(clientId, {
      ok: false,
      failures: [
        { code: rejected.code, message: rejected.message, rule: 'server' },
      ],
    });
    return false;
  }
  return true;
}

function requireAccepted(s: ContentHarness, clientId: string): void {
  const result = s.lastResult.get(clientId);
  if (result?.ok !== true)
    throw new Error(`Content setup refused: ${JSON.stringify(result)}`);
}

export async function createDraftFor(
  s: ContentHarness,
  clientId: string,
  args: {
    readonly title: string;
    readonly valid: boolean;
  }
): Promise<void> {
  const documentId = s.session.ports.createId();
  const draftId = s.session.ports.createId();
  const body: ContentBody = {
    title: args.title,
    description: '',
    difficulty: '',
    definition: args.valid ? 'target:2' : 'target:',
  };
  await sendContentMutation(s, clientId, 'createPuzzleContent', {
    documentId,
    draftId,
    gameId: s.games.get(clientId) ?? 'counting',
    kind: 'puzzle',
    body,
  });
  requireAccepted(s, clientId);
  s.documents.set(args.title, documentId);
  s.selectedPuzzles.set(clientId, documentId);
  s.editors.set(clientId, { documentId, parentId: draftId, body });
}

export const chooseContentGame = defineAction({
  name: 'chooseContentGame',
  act: (s: ContentHarness, clientId: string) => {
    s.games.set(clientId, 'counting');
  },
});

export const createContentDraft = defineAction({
  name: 'createContentDraft',
  act: (s: ContentHarness, clientId: string, title: string) =>
    createDraftFor(s, clientId, { title, valid: false }),
});

export const arrangeContentDraft = defineAction({
  name: 'arrangeContentDraft',
  act: async (
    s: ContentHarness,
    clientId: string,
    args: { readonly title: string; readonly valid: boolean }
  ) => {
    await createDraftFor(s, clientId, args);
    if (args.valid) {
      const editor = currentContentEditor(s, clientId);
      await sendContentMutation(s, clientId, 'validatePuzzleContentDraft', {
        documentId: editor.documentId,
        draftId: editor.parentId,
      });
      requireAccepted(s, clientId);
    }
  },
});

export function currentContentEditor(
  s: ContentHarness,
  clientId: string
): ContentEditor {
  const editor = s.editors.get(clientId);
  if (editor === undefined)
    throw new Error('Open a content draft before editing it');
  return editor;
}

export const changeContentMetadata = defineAction({
  name: 'changeContentMetadata',
  act: (
    s: ContentHarness,
    clientId: string,
    metadata: Partial<Pick<ContentBody, 'title' | 'description' | 'difficulty'>>
  ) => {
    const editor = currentContentEditor(s, clientId);
    editor.body = { ...editor.body, ...metadata };
  },
});

export async function saveContentEditor(
  s: ContentHarness,
  clientId: string
): Promise<void> {
  const editor = currentContentEditor(s, clientId);
  const draftId = s.session.ports.createId();
  const accepted = await sendContentMutation(
    s,
    clientId,
    'savePuzzleContentDraft',
    {
      documentId: editor.documentId,
      parentId: editor.parentId,
      draftId,
      body: editor.body,
    }
  );
  if (accepted) s.editors.set(clientId, { ...editor, parentId: draftId });
}

export const saveContentDraft = defineAction({
  name: 'saveContentDraft',
  act: saveContentEditor,
});

export const renameContentDraft = defineAction({
  name: 'renameContentDraft',
  act: async (s: ContentHarness, clientId: string, title: string) => {
    const editor = currentContentEditor(s, clientId);
    editor.body = { ...editor.body, title };
    await saveContentEditor(s, clientId);
  },
});

export const renameOtherContentDraft = defineAction({
  name: 'renameOtherContentDraft',
  act: async (s: ContentHarness, clientId: string, title: string) => {
    const source = currentContentEditor(s, 'alice:phone');
    await sendContentMutation(s, clientId, 'savePuzzleContentDraft', {
      documentId: source.documentId,
      parentId: source.parentId,
      draftId: s.session.ports.createId(),
      body: { ...source.body, title },
    });
  },
});

export const openContentDraft = defineAction({
  name: 'openContentDraft',
  act: async (s: ContentHarness, clientId: string, title: string) => {
    const id = s.documents.get(title);
    if (id === undefined) throw new Error(`Unknown content example: ${title}`);
    const draft = workingContentDraft(
      await readContentLibrary(contentClient(s, clientId).db),
      id
    );
    if (draft === null) {
      s.notices.set(clientId, 'private');
      return;
    }
    s.editors.set(clientId, {
      documentId: id,
      parentId: draft.id,
      body: contentBody(draft),
    });
    s.notices.delete(clientId);
  },
});

export const copyContentEditorToTablet = defineAction({
  name: 'copyContentEditorToTablet',
  act: (s: ContentHarness) => {
    const source = currentContentEditor(s, 'alice:phone');
    s.editors.set('alice:tablet', { ...source, body: { ...source.body } });
    const packId = s.selectedPacks.get('alice:phone');
    if (packId !== undefined) s.selectedPacks.set('alice:tablet', packId);
    const puzzleId = s.selectedPuzzles.get('alice:phone');
    if (puzzleId !== undefined) s.selectedPuzzles.set('alice:tablet', puzzleId);
  },
});

export const CONTENT_ACTIONS = [
  chooseContentGame,
  createContentDraft,
  arrangeContentDraft,
  changeContentMetadata,
  saveContentDraft,
  renameContentDraft,
  renameOtherContentDraft,
  openContentDraft,
  copyContentEditorToTablet,
] as const;
