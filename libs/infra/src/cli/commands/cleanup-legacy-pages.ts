import { PROJECT_CONFIG } from '../../project-config';
import {
  cleanupPagesDeployments,
  deletePagesProject,
} from '../lib/cloudflare-pages-deployments';
import { banner, fail, kv, ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import type { Command } from './types';

function parseConcurrency(): number | undefined {
  const flag = process.argv.find((arg) => arg.startsWith('--concurrency='));
  if (!flag) return undefined;
  const value = Number.parseInt(flag.slice('--concurrency='.length), 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

async function drainLegacyPagesDeployments(
  concurrency?: number
): Promise<void> {
  const accountId = cfAccountId();
  const projectName = PROJECT_CONFIG.cloudflare.legacyPagesProject;
  const headers = cfHeaders();

  if (!accountId) {
    fail('Cloudflare', 'CLOUDFLARE_ACCOUNT_ID is missing');
    process.exit(1);
  }

  let pass = 0;
  while (true) {
    pass++;
    const result = await cleanupPagesDeployments({
      accountId,
      projectName,
      headers,
      ...(concurrency !== undefined ? { concurrency } : {}),
    });

    kv(`pass ${pass} total`, String(result.total));
    kv(`pass ${pass} deleted`, String(result.deleted));
    kv(`pass ${pass} failed`, String(result.failed));

    if (result.failed > 0) {
      fail(
        'Pages deployments',
        `${result.failed} deletion(s) failed — fix errors and retry`
      );
      process.exit(1);
    }

    if (result.deleted === 0) break;
  }

  ok('Pages deployments', 'legacy client project drained');
}

export class CleanupLegacyPagesCommand implements Command {
  readonly id = 'cleanup-legacy-pages';
  readonly group = 'lifecycle' as const;
  readonly danger = true;
  readonly summary =
    'Delete stale Cloudflare Pages deployments for the retired client project';

  constructor(_platform: CiPlatform) {}

  async execute(): Promise<void> {
    banner('Cleanup legacy Pages deployments');
    kv('project', PROJECT_CONFIG.cloudflare.legacyPagesProject);

    const deleteProject = process.argv.includes('--delete-project');
    await drainLegacyPagesDeployments(parseConcurrency());

    if (!deleteProject) {
      ok(
        'Next step',
        're-run with --delete-project to remove the empty Pages project'
      );
      return;
    }

    const accountId = cfAccountId();
    const projectName = PROJECT_CONFIG.cloudflare.legacyPagesProject;
    const deleted = await deletePagesProject(
      accountId,
      projectName,
      cfHeaders()
    );
    if (deleted.ok) {
      ok('Pages project deleted', projectName);
      return;
    }

    warn('Pages project delete', `${projectName} — ${deleted.message}`);
    process.exit(1);
  }
}
