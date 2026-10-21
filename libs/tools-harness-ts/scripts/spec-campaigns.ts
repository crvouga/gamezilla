// @io-wall-ok — spec discovery reads package manifests and campaign inputs.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type SpecCampaign = {
  readonly dir: string;
  readonly domain: string;
};

export function campaignOwnershipProblems(
  campaigns: readonly SpecCampaign[],
  owners: ReadonlyMap<string, readonly string[]>
): readonly string[] {
  return [...new Set(campaigns.map((campaign) => campaign.domain))]
    .filter((domain) => owners.get(domain)?.length !== 1)
    .map(
      (domain) =>
        `specs/${domain}/: a Quint campaign must have exactly one owner`
    );
}

type CampaignTasks = SpecCampaign & {
  readonly scripts: Readonly<Record<string, string>>;
  readonly tasks: Readonly<
    Record<string, { readonly inputs?: readonly string[] }>
  >;
  readonly sources: readonly string[];
};

type CampaignManifest = {
  readonly quintCampaignDomains?: readonly string[];
  readonly scripts?: CampaignTasks['scripts'];
};

type CampaignTurbo = { readonly tasks?: CampaignTasks['tasks'] };

const CONTRACT_PART = /^test:contract:\d+$/;

/** Numbered product contract tasks, in script-name order. */
export function contractPartNames(
  scripts: Readonly<Record<string, string>>
): readonly string[] {
  return Object.keys(scripts)
    .filter((name) => CONTRACT_PART.test(name))
    .sort();
}

/** The monolith or every numbered part is in the release gate. */
export function contractGateCovered(
  packageName: string,
  scripts: Readonly<Record<string, string>>,
  gatingTasks: ReadonlySet<string>
): boolean {
  if (gatingTasks.has(`${packageName}#test:contract`)) return true;
  const parts = contractPartNames(scripts);
  return (
    parts.length > 0 &&
    parts.every((name) => gatingTasks.has(`${packageName}#${name}`))
  );
}

function runsCampaignFile(
  scripts: Readonly<Record<string, string>>,
  task: string,
  path: string
): boolean {
  if (scripts[task]?.includes(path)) return true;
  if (task !== 'test:contract') return false;
  const parts = contractPartNames(scripts);
  return (
    parts.length > 0 && parts.every((name) => scripts[name]?.includes(path))
  );
}

function campaignInputLists(
  tasks: CampaignTasks['tasks'],
  task: string
): readonly (readonly string[] | undefined)[] {
  if (tasks[task] !== undefined) return [tasks[task]?.inputs];
  if (task !== 'test:contract') return [undefined];
  const parts = Object.keys(tasks).filter((name) => CONTRACT_PART.test(name));
  if (parts.length === 0) return [undefined];
  return parts.map((name) => tasks[name]?.inputs);
}

/** Preserve simulation, fault sensitivity, symbolic verifications and cache invalidation. */
export function campaignTaskProblems(input: CampaignTasks): readonly string[] {
  const problems: string[] = [];
  const verifications = {
    test: ['simulation.test.ts', 'effectiveness.test.ts'],
    'test:contract': ['model-checks.test.ts'],
  };
  for (const [task, files] of Object.entries(verifications)) {
    for (const file of files) {
      const path = `tests/quint/${file}`;
      if (!runsCampaignFile(input.scripts, task, path)) {
        problems.push(`${input.dir}/package.json: ${task} must run ${path}`);
      }
    }
    for (const source of new Set([`specs/${input.domain}`, ...input.sources])) {
      const glob = `$TURBO_ROOT$/${source}/**`;
      const missing = campaignInputLists(input.tasks, task).some(
        (inputs) => !inputs?.includes(glob)
      );
      if (missing) {
        problems.push(
          `${input.dir}/turbo.json: ${task} inputs must include "${glob}"`
        );
      }
    }
  }
  return problems;
}

/** Composed interpretations run as campaigns rather than aggregate bindings. */
export function specCampaigns(root: string): readonly SpecCampaign[] {
  return ['apps', 'libs', 'pkgs'].flatMap((tier) =>
    [...new Bun.Glob(`${tier}/*/package.json`).scanSync({ cwd: root })]
      .sort()
      .flatMap((path) => {
        const manifest = JSON.parse(
          readFileSync(join(root, path), 'utf8')
        ) as CampaignManifest;
        return (manifest.quintCampaignDomains ?? []).map((domain: string) => ({
          dir: path.slice(0, -'/package.json'.length),
          domain,
        }));
      })
  );
}

/** Both cached Verify leaves must run and hash every campaign's source set. */
export function campaignProblems(
  root: string,
  campaigns: readonly SpecCampaign[]
): readonly string[] {
  const problems: string[] = [];
  for (const { dir, domain } of campaigns) {
    const manifest = JSON.parse(
      readFileSync(join(root, dir, 'package.json'), 'utf8')
    ) as CampaignManifest;
    const turboPath = join(root, dir, 'turbo.json');
    const tasks = existsSync(turboPath)
      ? ((JSON.parse(readFileSync(turboPath, 'utf8')) as CampaignTurbo).tasks ??
        {})
      : {};
    const files = [
      ...new Bun.Glob(`specs/${domain}/*.qnt`).scanSync({ cwd: root }),
    ];
    for (const file of new Bun.Glob(`specs/${domain}/*`).scanSync({
      cwd: root,
    })) {
      if (
        !file.endsWith('.qnt') &&
        !file.endsWith('/ubiquitous-language.yml')
      ) {
        problems.push(`${file}: a Quint campaign runs only .qnt modules`);
      }
    }
    if (files.length === 0)
      problems.push(`specs/${domain}/: campaign has no Quint modules`);
    const sources = new Set<string>();
    for (const path of files) {
      const text = readFileSync(join(root, path), 'utf8');
      const declared =
        /^\/\/ Sources: (.+)$/m.exec(text)?.[1]?.split(', ') ?? [];
      for (const source of declared) sources.add(source);
      if (!/^\/\/ @spec-(?:meta|interpretation)(?:\s|$)/.test(text)) {
        problems.push(
          `${path}: campaign modules must declare @spec-interpretation or @spec-meta`
        );
      }
    }
    if (sources.size === 0)
      problems.push(
        `specs/${domain}/: campaign must compose declared source domains`
      );
    problems.push(
      ...campaignTaskProblems({
        dir,
        domain,
        scripts: manifest.scripts ?? {},
        tasks,
        sources: [...sources],
      })
    );
  }
  return problems;
}
