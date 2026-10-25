import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { z } from 'zod';
import { MultiplayerGameRepository } from './game-repository';
import { runLiveMatchCommand } from './live-match-command';

/** Host-invoked projection, deliberately absent from the client mutation registry. */
export const synchronizeLiveMatchMutation = defineMutation({
  name: 'synchronizeLiveMatch',
  args: z.object({ gameId: z.string().min(1), requestId: z.string().min(1) }),
  async run(ctx, args) {
    const rooms = ctx.env.rooms;
    const nowMs = ctx.env.serverNow?.().getTime();
    if (rooms === undefined || nowMs === undefined)
      throw new Error(
        'match projection requires the injected server room service'
      );
    const repository = new MultiplayerGameRepository(ctx.tx);
    const found = await repository.byId(args.gameId);
    if (found === null) return;
    const stored = await repository.owned(found.id, found.white_id, nowMs);
    if (stored.outcome !== 'ongoing') return;
    const accepted = await runLiveMatchCommand(
      rooms,
      stored,
      { actorId: ctx.env.actorId, kind: 'sync' },
      args.requestId
    );
    await repository.save(stored, accepted, nowMs, {
      server: true,
      publish: ctx.env,
    });
  },
});
