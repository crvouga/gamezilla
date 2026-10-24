import { defineContext } from '@pkgs/solid-context-client-ts/define-context';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import type { PuzzleContentCatalog } from '@pkgs/turn-game-shared-ts/puzzle-content-catalog';
import type { PuzzleContentClient } from './puzzle-content-client';

export type ContentView =
  | { readonly kind: 'library' }
  | { readonly kind: 'edit'; readonly documentId: string }
  | {
      readonly kind: 'edition';
      readonly revisionId: string;
      readonly packRevisionId: string | null;
    }
  | { readonly kind: 'attempt'; readonly attemptId: string };

export type ContentGame = {
  readonly id: string;
  readonly title: string;
  readonly content: PuzzleContent;
  readonly client: PuzzleContentClient;
  readonly catalog: PuzzleContentCatalog;
  readonly open: (view: ContentView) => void;
};

const ContentGameContext = defineContext<ContentGame>('PuzzleContentGame');
export const ContentGameProvider = ContentGameContext.Provider;
export const useContentGame = ContentGameContext.use;
