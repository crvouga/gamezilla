import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import {
  createDraftFor,
  currentContentEditor,
  saveContentEditor,
} from './content-actions';
import { selectPackEditor } from './content-selection';
import type { ContentHarness } from './content-system';
import { editPackFor } from './pack-actions';
import {
  arrangePackFor,
  arrangePublishedPuzzle,
  createPackFor,
} from './pack-fixtures';

const titlesOf = (text: string) => (text.length === 0 ? [] : text.split(', '));

export const arrangeNamedPack = defineAction({
  name: 'arrangeNamedPack',
  act: async (
    s: ContentHarness,
    args: {
      readonly title: string;
      readonly titles: string;
      readonly published?: boolean;
    }
  ) => {
    await arrangePackFor(s, { ...args, titles: titlesOf(args.titles) });
  },
});

export const arrangeUnpublishedPack = defineAction({
  name: 'arrangeUnpublishedPack',
  act: async (s: ContentHarness, title: string, puzzle: string) => {
    await createDraftFor(s, 'alice:phone', { title: puzzle, valid: true });
    await createPackFor(s, { title, titles: [puzzle] });
  },
});

export const arrangeOtherGamePuzzle = defineAction({
  name: 'arrangeOtherGamePuzzle',
  act: async (s: ContentHarness, title: string) => {
    s.games.set('alice:phone', 'other-counting');
    await arrangePublishedPuzzle(s, title);
    s.games.set('alice:phone', 'counting');
  },
});

export const editNamedPack = defineAction({
  name: 'editNamedPack',
  act: async (
    s: ContentHarness,
    args: {
      readonly kind: 'add' | 'move' | 'remove';
      readonly title: string;
      readonly before?: string;
    }
  ) => {
    const puzzleId = s.documents.get(args.title);
    if (puzzleId === undefined) throw new Error('Unknown fixture puzzle');
    const edit =
      args.kind === 'move'
        ? {
            kind: 'move' as const,
            puzzleId,
            beforeId: s.documents.get(args.before ?? '') ?? '',
          }
        : { kind: args.kind, puzzleId };
    await editPackFor(s, 'alice:phone', edit);
  },
});

export const saveNamedPackOrder = defineAction({
  name: 'saveNamedPackOrder',
  act: async (s: ContentHarness, clientId: string, titles: string) => {
    await selectPackEditor(s, clientId);
    const editor = currentContentEditor(s, clientId);
    const pack = decodePackDefinition(editor.body.definition);
    if (pack === null) throw new Error('Invalid fixture pack');
    const items = titlesOf(titles).map((title) => {
      const item = pack.items.find(
        (entry) => entry.puzzleId === s.documents.get(title)
      );
      if (item === undefined) throw new Error('Unknown fixture pack puzzle');
      return item;
    });
    editor.body = { ...editor.body, definition: JSON.stringify({ items }) };
    await saveContentEditor(s, clientId);
  },
});

export const NAMED_PACK_ACTIONS = [
  arrangeNamedPack,
  arrangeUnpublishedPack,
  arrangeOtherGamePuzzle,
  editNamedPack,
  saveNamedPackOrder,
] as const;
