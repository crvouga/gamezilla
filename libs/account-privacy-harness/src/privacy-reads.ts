import { readPrivacyStatus } from '@libs/account-privacy-shared/privacy-status';
import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import sql from '@pkgs/sql-shared/sql';

export function exportCategories(s: ProductHarness): string[] {
  return s.harness.composition.app.accountPrivacy.map(
    (contribution) => contribution.name
  );
}

export async function privacyText(
  s: ProductHarness,
  actor: string,
  testId: string
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  return (await ui.get(testId).isVisible()) ? ui.get(testId).text() : null;
}

export async function privacyStatus(s: ProductHarness, accountId: string) {
  return readPrivacyStatus(
    s.harness.serverSql.sqlClient,
    accountId,
    s.harness.clock.now()
  );
}

/** The content the download links offer, after the proven owner can see them. */
export async function downloadedExport(s: ProductHarness, actor: string) {
  const ui = await actorUi(s, actor);
  if (!(await ui.get('privacy-export-ready').isVisible())) return null;
  const db = s.actors.get(actor)?.localSql();
  if (db == null) return null;
  const rows = await db.query(
    sql<{
      export_detail: string;
      export_summary: string;
      requested_at: string;
      ready_at: string;
    }>`SELECT export_detail, export_summary, requested_at, ready_at FROM profile_account_privacy WHERE export_status = ${'Ready'} AND deletion_at IS NULL AND export_detail IS NOT NULL`
  );
  return rows[0] ?? null;
}
