import { downloadedExport } from '@libs/account-privacy-harness/privacy-reads';
import { CHESS_PRIVACY } from '@libs/chess-sub-shared/account-privacy';
import type { CustomGame } from '@libs/game-session-shared/custom-game-state';
import type { ProductHarness } from '@libs/harness/harness';

/** Games offered in the proven person's readable and reusable export. */
export async function readExportedCustomGames(
  s: ProductHarness,
  actor: string
): Promise<readonly CustomGame[] | null> {
  const data = await downloadedExport(s, actor);
  if (data === null) return null;
  const detail = JSON.parse(data.export_detail) as {
    categories: Record<string, { customGames?: readonly CustomGame[] }>;
  };
  const games = detail.categories[CHESS_PRIVACY.name]?.customGames;
  if (!Array.isArray(games))
    throw new Error('The personal-data export has no Custom Games');
  return games;
}
