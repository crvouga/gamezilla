import { dismissOwnNotification } from '@libs/notifications-shared-ts/dismiss-notification';
import { buildNotificationId } from '@libs/notifications-shared-ts/notification-id';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { z } from 'zod';
import { MultiplayerGameRepository } from './game-repository';
import { multiplayerResultNoticeSource } from './multiplayer-notices';

/**
 * One of a daily game's two people takes their own result notice out of
 * their inbox. Their multiplayer opponent's stays; anyone else is refused.
 */
export async function dismissMultiplayerResultNotice(
  tx: SqlTx,
  notice: { readonly gameId: string; readonly userId: string },
  nowMs: number
): Promise<void> {
  await new MultiplayerGameRepository(tx).owned(notice.gameId, notice.userId);
  await dismissOwnNotification(
    tx,
    {
      id: buildNotificationId(
        multiplayerResultNoticeSource(notice.gameId),
        notice.userId
      ),
      userId: notice.userId,
    },
    new Date(nowMs).toISOString()
  );
}

/** Decided on the server, so it needs a connection like every other command. */
export const dismissMultiplayerResultNoticeMutation = defineMutation({
  name: 'dismissMultiplayerResultNotice',
  requiresOnline: true,
  pendingUx: 'pending',
  args: z.object({ gameId: z.string().min(1) }),
  run: async (ctx, args) => {
    const serverNow = ctx.env.serverNow;
    if (serverNow === undefined) return;
    await dismissMultiplayerResultNotice(
      ctx.tx,
      { gameId: args.gameId, userId: ctx.env.actorId },
      serverNow().getTime()
    );
  },
});
