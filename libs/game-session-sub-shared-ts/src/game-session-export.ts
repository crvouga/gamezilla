import type { GameSession } from '@libs/game-session-shared-ts/game-session-state';
import { GameSessionsAttr } from '@libs/game-session-shared-ts/game-session-state';
import type { AccountPrivacyContribution } from '@libs/sub-shared-ts/account-privacy';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationCtx } from '@pkgs/sync-engine-shared-ts/mutations-types';

/** Retained choices and play belong only to the game's creator or participants. */
export async function snapshotGameSessions(
  ctx: MutationCtx,
  rooms: Parameters<AccountPrivacyContribution['snapshot']>[1]
): Promise<readonly GameSession[]> {
  const spaces = await ctx.tx.query(
    sql<{
      id: string;
    }>`SELECT DISTINCT s.id FROM spaces s LEFT JOIN spaces_users u ON u.space_id = s.id WHERE s.host_id = ${ctx.env.actorId} OR s.host_account_id = ${ctx.env.actorId} OR s.host_member_id = ${ctx.env.actorId} OR u.user_id = ${ctx.env.actorId}`
  );
  const result: GameSession[] = [];
  for (const space of spaces) {
    const games = GameSessionsAttr.from(await rooms.read(`space:${space.id}`));
    const retained =
      games.current === null
        ? games.history
        : [...games.history, games.current];
    result.push(
      ...retained.filter(
        (game) =>
          game.creator === ctx.env.actorId ||
          game.sides.some(
            (side) =>
              game[side].kind === 'person' &&
              game[side].person === ctx.env.actorId
          )
      )
    );
  }
  return result;
}
