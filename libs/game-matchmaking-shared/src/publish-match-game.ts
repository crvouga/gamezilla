import { Outbox } from '@pkgs/outbox-shared/outbox';
import type { OutboxSendCtx } from '@pkgs/outbox-shared/types';
import type { MultiplayerGame } from './game-state';
import { MultiplayerGameChanged } from './match-room';

export async function publishMatchGame(
  ctx: OutboxSendCtx,
  game: MultiplayerGame
): Promise<void> {
  await new Outbox(ctx).send({
    id: ctx.env.createId(),
    message: MultiplayerGameChanged(game),
  });
}
