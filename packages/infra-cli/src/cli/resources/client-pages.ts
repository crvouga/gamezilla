import { ok, warn } from '../lib/fmt';
import { PROJECT_CONFIG } from '../../project-config';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import { runSafe, type SpawnResult } from '../subprocess';
import type { Resource } from './types';

const NOT_FOUND_CODES = [8000007];

export class ClientPagesResource implements Resource {
  readonly id = 'client-pages';

  async destroy(): Promise<void> {
    const name = PROJECT_CONFIG.cloudflare.pagesProject;
    await this.detachCustomDomains(name);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: cfAccountId(),
    };

    const r = runSafe('wrangler', ['pages', 'project', 'delete', name, '--yes'], { env });

    if (r.exitCode === 0 || isNotFound(r)) {
      ok('Pages project deleted', name);
    } else {
      warn('Pages project delete', r.stderr.trim() || 'unexpected failure');
    }
  }

  private async detachCustomDomains(project: string): Promise<void> {
    const accountId = cfAccountId();
    const headers = cfHeaders();
    if (!accountId) {
      warn('Pages domains', 'missing account ID — skipping');
      return;
    }

    const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}/domains`;

    const listRes = await fetch(base, { headers });
    if (!listRes.ok) {
      if (listRes.status === 404) return;
      warn('Pages domains list', `HTTP ${listRes.status}`);
      return;
    }

    const body = (await listRes.json()) as {
      result?: Array<{ name: string }>;
    };
    const domains = body.result ?? [];

    for (const { name } of domains) {
      const delRes = await fetch(`${base}/${name}`, {
        method: 'DELETE',
        headers,
      });
      if (delRes.ok || delRes.status === 404) {
        ok('Detached domain', name);
      } else {
        warn('Detach domain', `${name} — HTTP ${delRes.status}`);
      }
    }
  }
}

function isNotFound(r: SpawnResult): boolean {
  return NOT_FOUND_CODES.some((code) => r.stderr.includes(`[code: ${code}]`));
}
