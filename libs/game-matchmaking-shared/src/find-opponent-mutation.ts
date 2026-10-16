import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { z } from 'zod';
import { beginOpponentSearch } from './opponent-search';

export const findOpponentMutation = defineMutation({
  name: 'findChessOpponent',
  requiresOnline: true,
  pendingUx: 'pending',
  args: z.object({
    spaceId: z.string().min(1),
    requestId: z.string().min(1),
    timeControl: z.string().min(1).max(32),
  }),
  run: (ctx, args) => beginOpponentSearch(ctx, args),
});
