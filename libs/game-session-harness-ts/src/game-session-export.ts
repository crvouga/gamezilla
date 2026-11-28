import { downloadedExport } from '@libs/account-privacy-harness-ts/privacy-reads';
import type { GameSession } from '@libs/game-session-shared-ts/game-session-state';
import { GAME_SESSION_PRIVACY } from '@libs/game-session-sub-shared-ts/account-privacy';
import type { ProductHarness } from '@libs/harness-ts/harness';

/** Games offered in the proven person's readable and reusable export. */
export async function readExportedGameSessions(
  s: ProductHarness,
  actor: string
): Promise<readonly GameSession[] | null> {
  const data = await downloadedExport(s, actor);
  if (data === null) return null;
  const detail = JSON.parse(data.export_detail) as {
    categories: Record<string, { gameSessions?: readonly GameSession[] }>;
  };
  const games = detail.categories[GAME_SESSION_PRIVACY.name]?.gameSessions;
  if (!Array.isArray(games))
    throw new Error('The personal-data export has no Game Sessions');
  return games;
}
