import { defineSub } from '@libs/sub-shared-ts/manifest';
import { CHESS_STORAGE } from './catalogue-storage';
import { CHESS_MUTATIONS } from './mutations';
import { CHESS_QUERIES } from './queries';

export const CHESS_SUB = defineSub({
  ...CHESS_STORAGE,
  queries: CHESS_QUERIES,
  mutations: async () => CHESS_MUTATIONS,
});
