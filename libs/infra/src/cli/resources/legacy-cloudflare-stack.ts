import { PROJECT_CONFIG } from '../../project-config';
import {
  cleanupPagesDeployments,
  deletePagesProject,
} from '../lib/cloudflare-pages-deployments';
import { deleteWorkerByName } from '../lib/cloudflare-worker-lifecycle';
import { ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import { ResourceBase, type InfraContext } from './types';

async function drainLegacyPagesDeployments(): Promise<void> {
  const accountId = cfAccountId();
  const projectName = PROJECT_CONFIG.cloudflare.legacyPagesProject;
  const headers = cfHeaders();

  while (true) {
    const result = await cleanupPagesDeployments({
      accountId,
      projectName,
      headers,
    });
    if (result.failed > 0) {
      warn(
        'Pages deployments',
        `${result.failed} deletion(s) failed for ${projectName}`
      );
      return;
    }
    if (result.deleted === 0) return;
  }
}

export class LegacyCloudflareStackResource extends ResourceBase {
  readonly id = 'legacy-cloudflare-stack';
  override readonly routineStatus = 'destroyed';

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {}

  async destroy(_platform: CiPlatform): Promise<void> {
    for (const workerName of PROJECT_CONFIG.cloudflare.legacyWorkers) {
      deleteWorkerByName(workerName);
    }

    await drainLegacyPagesDeployments();

    const accountId = cfAccountId();
    const projectName = PROJECT_CONFIG.cloudflare.legacyPagesProject;
    const headers = cfHeaders();
    const deleted = await deletePagesProject(accountId, projectName, headers);
    if (deleted.ok) {
      ok('Pages project deleted', projectName);
      return;
    }

    warn('Pages project delete', `${projectName} — ${deleted.message}`);
  }
}
