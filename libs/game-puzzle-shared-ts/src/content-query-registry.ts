import {
  puzzleContentAttemptsOwned,
  puzzleContentCompletionsOwned,
  puzzleContentPositionsOwned,
} from './attempt-query';
import {
  puzzleContentDraftCopies,
  puzzleContentEditions,
  puzzleContentPackItems,
} from './content-detail-queries';
import { puzzleContentDocumentsById } from './content-document-query';
import { puzzleContentOwned, puzzleContentPublished } from './content-queries';

export const CONTENT_QUERIES = [
  puzzleContentOwned,
  puzzleContentPublished,
  puzzleContentDraftCopies,
  puzzleContentEditions,
  puzzleContentPackItems,
  puzzleContentAttemptsOwned,
  puzzleContentPositionsOwned,
  puzzleContentCompletionsOwned,
  puzzleContentDocumentsById,
] as const;
