import { downloadedExport } from '@libs/account-privacy/harness/privacy-reads';
import type { ProductHarness } from '@libs/harness/system/harness';
import type { CustomGame } from '../public/custom-game';
import { CHESS_PRIVACY } from '../shared/puzzles/account-privacy';

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
