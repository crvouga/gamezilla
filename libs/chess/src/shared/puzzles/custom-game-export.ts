import type { AccountPrivacyContribution } from '@libs/feature/public/account-privacy';
import { sql } from '@pkgs/sql';
import type { MutationCtx } from '@pkgs/sync-engine/shared';
import {
  type CustomGame,
  CustomGamesAttr,
} from '../custom-game/custom-game-state';

/** Retained choices and play belong only to the game's creator or participants. */
export async function snapshotCustomGames(
  ctx: MutationCtx,
  rooms: Parameters<AccountPrivacyContribution['snapshot']>[1]
): Promise<readonly CustomGame[]> {
  const spaces = await ctx.tx.query(
    sql<{
      id: string;
    }>`SELECT DISTINCT s.id FROM spaces s LEFT JOIN spaces_users u ON u.space_id = s.id WHERE s.host_id = ${ctx.env.actorId} OR s.host_account_id = ${ctx.env.actorId} OR s.host_member_id = ${ctx.env.actorId} OR u.user_id = ${ctx.env.actorId}`
  );
  const result: CustomGame[] = [];
  for (const space of spaces) {
    const games = CustomGamesAttr.from(await rooms.read(`space:${space.id}`));
    const retained =
      games.current === null
        ? games.history
        : [...games.history, games.current];
    result.push(
      ...retained.filter(
        (game) =>
          game.creator === ctx.env.actorId ||
          (game.white.kind === 'person' &&
            game.white.person === ctx.env.actorId) ||
          (game.black.kind === 'person' &&
            game.black.person === ctx.env.actorId)
      )
    );
  }
  return result;
}
