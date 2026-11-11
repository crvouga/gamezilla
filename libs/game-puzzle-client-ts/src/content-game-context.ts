import { defineContext } from '@pkgs/solid-context-client-ts/define-context';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import type { PuzzleContentCatalog } from '@pkgs/turn-game-shared-ts/puzzle-content-catalog';
import type { Accessor } from 'solid-js';
import type { ContentPlace, ContentSubject } from './content-places';
import type { PuzzleContentClient } from './puzzle-content-client';

export type ContentGame = {
  readonly id: string;
  readonly title: string;
  readonly content: PuzzleContent;
  readonly client: PuzzleContentClient;
  readonly catalog: PuzzleContentCatalog;
  /** Opens the library, a builder, an edition or an attempt, on its home. */
  readonly open: (subject: ContentSubject) => void;
};

const ContentGameContext = defineContext<ContentGame>('PuzzleContentGame');
export const ContentGameProvider = ContentGameContext.Provider;
export const useContentGame = ContentGameContext.use;

/** The small screen this device shows of what is open, and how it moves. */
export type ContentPlaceNavigation = {
  readonly place: Accessor<ContentPlace>;
  /** Shows another of the open thing's small screens. */
  readonly open: (place: ContentPlace) => void;
};

const ContentPlaceContext =
  defineContext<ContentPlaceNavigation>('PuzzleContentPlace');
export const ContentPlaceProvider = ContentPlaceContext.Provider;
export const useContentPlace = ContentPlaceContext.use;
