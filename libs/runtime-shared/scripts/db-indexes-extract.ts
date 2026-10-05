// @io-wall-ok — CLI composition root for workload extract / plan comment.

import { APP_QUERIES } from '@libs/runtime-shared/app-queries';
import { renderPlanMarkdown } from '@pkgs/db-indexes-root-shared/render';
import { extractWorkload } from '@pkgs/sync-engine-shared/extract-workload';

async function main(): Promise<void> {
  const manifest = await extractWorkload(APP_QUERIES);
  const mode = (process.argv[2] ?? 'json').trim();
  if (mode === 'markdown') {
    // Plan without a live DB: empty actions, desired unknown — print manifest summary.
    const fakePlan = {
      desired: [],
      actions: [],
      skipped: [],
      kept: [],
    };
    process.stdout.write(
      `${renderPlanMarkdown(fakePlan, manifest)}\n\n## Manifest queries\n\n`
    );
    for (const q of manifest.queries) {
      process.stdout.write(
        `- **${q.name}**: ${String(q.statements.length)} statement(s)\n`
      );
    }
    return;
  }
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

await main();
