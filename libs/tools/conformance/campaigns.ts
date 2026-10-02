// @io-wall-ok — the conformance adapter discovers registered verification campaigns.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SpecFile } from '@pkgs/conformance/proofs';
import { campaignProblems, specCampaigns } from '../scripts/spec-campaigns';
import { REPO_ROOT } from '../scripts/spec-packages';

/** Campaign modules are checked together, without claiming product conformance. */
export function campaignBindings(gatingTasks: ReadonlySet<string>): {
  readonly domains: ReadonlySet<string>;
  readonly specs: readonly SpecFile[];
  readonly problems: readonly string[];
} {
  const campaigns = specCampaigns(REPO_ROOT);
  const problems = [...campaignProblems(REPO_ROOT, campaigns)];
  const domains = new Set(campaigns.map((campaign) => campaign.domain));
  const specs: SpecFile[] = [];
  for (const domain of domains) {
    const owners = campaigns.filter((campaign) => campaign.domain === domain);
    const before = problems.length;
    if (owners.length !== 1)
      problems.push(
        `specs/${domain}/: a Quint campaign must have exactly one owner`
      );
    for (const owner of owners) {
      const manifest = JSON.parse(
        readFileSync(join(REPO_ROOT, owner.dir, 'package.json'), 'utf8')
      ) as { readonly name: string };
      for (const task of ['test', 'test:contract']) {
        const id = `${manifest.name}#${task}`;
        if (!gatingTasks.has(id))
          problems.push(
            `specs/${domain}/: the release gate does not run ${id}`
          );
      }
    }
    const bound = problems.length === before && before === 0;
    for (const name of readdirSync(join(REPO_ROOT, 'specs', domain))
      .filter((name) => name.endsWith('.qnt'))
      .sort())
      specs.push({
        path: `specs/${domain}/${name}`,
        context: domain,
        kind: 'dynamics',
        bound,
        harness: false,
        live: false,
      });
  }
  return { domains, specs, problems };
}
