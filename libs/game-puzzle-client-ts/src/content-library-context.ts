import type { AttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import type { ContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import { defineContext } from '@pkgs/solid-context-client-ts/define-context';
import type { Accessor } from 'solid-js';
import type { ContentPages } from './use-content-pages';

export type ContentLibraryState = {
  readonly content: Accessor<ContentLibrary>;
  readonly play: Accessor<AttemptLibrary>;
  readonly isLoading: Accessor<boolean>;
  readonly isFetching: Accessor<boolean>;
  readonly pages: ContentPages;
};
const LibraryContext = defineContext<ContentLibraryState>(
  'PuzzleContentLibrary'
);
export const ContentLibraryProvider = LibraryContext.Provider;
export const useContentLibraryState = LibraryContext.use;
