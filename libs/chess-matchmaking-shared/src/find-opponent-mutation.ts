import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { z } from 'zod';
import { beginChessSearch } from './chess-search';

export const findChessOpponentMutation = defineMutation({
  name: 'findChessOpponent',
  requiresOnline: true,
  pendingUx: 'pending',
  args: z.object({
    requestId: z.string().min(1),
    timeControl: z.string().min(1).max(16),
  }),
  run: (ctx, args) => beginChessSearch(ctx, args),
});
