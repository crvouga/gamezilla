/**
 * Build the infrastructure model from the OpenTofu source tree: parse every
 * stack, instantiate its modules for each environment's variables, evaluate
 * what is knowable offline, and resolve dependency edges. Pure — the script
 * that reads the files and the page that draws the result are the only
 * places that touch the outside world.
 */

import type { Block } from './hcl-ast';
import { evaluate } from './hcl-eval';
import { addressOf } from './hcl-refs';
import type { Value } from './hcl-value';
import { compareText, isList, isObject, isUnknown } from './hcl-value';
import type { Located } from './infra-config';
import type { ScopedEntry } from './infra-graph';
import { entriesOf, graphEdges, scopesOf } from './infra-graph';
import { text } from './infra-kind-helpers';
import type { ExternalRef, Kind, Link } from './infra-kinds';
import { kindOf, providerOf } from './infra-kinds';
import type {
  EdgeModel,
  EnvModel,
  InfraModel,
  InstanceModel,
  ModuleModel,
  NodeModel,
  ProviderUse,
  RemovedModel,
  StackModel,
} from './infra-model-types';
import { parseDeletable } from './infra-policy';
import { providerUses } from './infra-providers';
import type { ResourceEntry, Scope } from './infra-scope';
import { buildScope } from './infra-scope';
import type { SourceFiles, TofuSources } from './infra-source';
import { sourceFiles } from './infra-source';
import { GLOBAL_STACKS, STACKS } from './tofu-command';
import { resolveEnvVars, resolveGlobalVars } from './tofu-vars';

const TOFU = 'tofu';
const POLICY = 'policy/stateful.rego';
const IDENTITY_ATTRS = [
  'name',
  'function_name',
  'bucket_name',
  'hostname',
  'title',
  'variable_name',
  'environment',
  'domain_name',
  'slug',
  'repository',
] as const;

type Vars = Readonly<Record<string, Value>>;

type Build = {
  readonly files: SourceFiles;
  readonly deletable: ReadonlySet<string>;
};

function jsonObject(sources: TofuSources, path: string): Record<string, Value> {
  const raw = sources.get(path);
  if (raw === undefined) return {};
  return JSON.parse(raw) as Record<string, Value>;
}

function identity(attrs: Readonly<Record<string, Value>>): string | null {
  for (const key of IDENTITY_ATTRS) {
    const found = text(attrs, key);
    if (found !== null) return found;
  }
  return text(attrs, 'filter', 'name');
}

function externalsOf(
  entry: ResourceEntry,
  kind: Kind,
  vars: Vars
): ExternalRef[] {
  const seen = new Map<string, ExternalRef>();
  for (const instance of entry.expand().instances) {
    const found = kind.external?.({ attrs: instance.attrs, vars });
    if (found) seen.set(`${found.title}\u0000${found.name}`, found);
  }
  return [...seen.values()];
}

function instancesOf(
  entry: ResourceEntry,
  kind: Kind,
  vars: Vars
): { instances: InstanceModel[]; expansion: NodeModel['expansion'] } {
  const expanded = entry.expand();
  const instances = expanded.instances.map((instance) => ({
    key: instance.key,
    label:
      typeof instance.key === 'string'
        ? instance.key
        : identity(instance.attrs),
    links: [...(kind.links?.({ attrs: instance.attrs, vars }) ?? [])] as Link[],
  }));
  return { instances, expansion: expanded.expansion };
}

/** True when an import block's `for_each` is empty: declared, but inert. */
function inertImport(block: Block, scope: Scope): boolean {
  const forEach = block.body.attributes.get('for_each');
  if (forEach === undefined) return false;
  const value = evaluate(forEach, scope.env);
  if (isList(value)) return value.length === 0;
  return isObject(value) && Object.keys(value).length === 0;
}

function importTargets(scopes: readonly Scope[]): Set<string> {
  const targets = new Set<string>();
  for (const scope of scopes) {
    const prefix = addressPrefix(scope.path);
    for (const { value: block } of scope.config.imports) {
      if (inertImport(block, scope)) continue;
      const to = block.body.attributes.get('to');
      const address = to === undefined ? null : addressOf(to);
      if (address !== null) targets.add(`${prefix}${address}`);
    }
  }
  return targets;
}

function nodeOf(
  { entry, scope }: ScopedEntry,
  build: Build,
  vars: Vars,
  adopted: ReadonlySet<string>
): NodeModel {
  const kind = kindOf(entry.type);
  const { instances, expansion } = instancesOf(entry, kind, vars);
  const stateless = build.deletable.has(entry.type) || entry.mode === 'data';
  return {
    address: entry.address,
    mode: entry.mode,
    type: entry.type,
    name: entry.name,
    provider: providerOf(entry.type),
    title: kind.title,
    logo: kind.logo,
    category: kind.category,
    modulePath: scope.path,
    group: scope.path[0] ?? '',
    expansion,
    instances,
    externals: externalsOf(entry, kind, vars),
    stateful: !stateless,
    preventDestroy: entry.preventDestroy,
    adopted: adopted.has(entry.address),
    file: entry.file,
    line: entry.line,
  };
}

function moduleModels(root: Scope, nodes: readonly NodeModel[]): ModuleModel[] {
  return scopesOf(root)
    .filter((scope) => scope.path.length > 0)
    .map((scope) => ({
      name: scope.path.join('.'),
      path: scope.path,
      description: scope.config.header,
      dir: scope.dir,
      addresses: nodes
        .filter(
          (n) =>
            n.address.startsWith(addressPrefix(scope.path)) &&
            n.modulePath.join('.') === scope.path.join('.')
        )
        .map((n) => n.address),
    }));
}

function addressPrefix(path: readonly string[]): string {
  return path.map((s) => `module.${s}.`).join('');
}

function removedModels(root: Scope): RemovedModel[] {
  const out: RemovedModel[] = [];
  for (const scope of scopesOf(root)) {
    const prefix = addressPrefix(scope.path);
    for (const located of scope.config.removed) {
      const from = located.value.body.attributes.get('from');
      const address = from === undefined ? null : addressOf(from);
      if (address === null) continue;
      out.push({
        address: `${prefix}${address}`,
        provider: providerOf(address.split('.').slice(-2)[0] ?? ''),
        type: address.split('.').slice(-2)[0] ?? '',
        destroy: !isForget(located),
      });
    }
  }
  return out;
}

function isForget(located: Located<Block>): boolean {
  const lifecycle = located.value.body.blocks.find(
    (b) => b.type === 'lifecycle'
  );
  const destroy = lifecycle?.body.attributes.get('destroy');
  return destroy?.kind === 'literal' && destroy.value === false;
}

function stateBackend(root: Scope): StackModel['state'] {
  for (const { value: terraform } of root.config.terraform) {
    const backend = terraform.body.blocks.find((b) => b.type === 'backend');
    if (backend === undefined) continue;
    const read = (name: string): string | null => {
      const expr = backend.body.attributes.get(name);
      if (expr === undefined) return null;
      const value = evaluate(expr, root.env);
      return typeof value === 'string' && !isUnknown(value) ? value : null;
    };
    const encryption = terraform.body.blocks.find(
      (b) => b.type === 'encryption'
    );
    return {
      bucket: read('bucket'),
      key: read('key'),
      encrypted: encryption !== undefined,
    };
  }
  return { bucket: null, key: null, encrypted: false };
}

function stackModel(
  stack: string,
  env: string | null,
  vars: Vars,
  build: Build
): StackModel {
  const dir = `${TOFU}/stacks/${stack}`;
  const root = buildScope({
    files: build.files,
    dir,
    path: [],
    parent: null,
    call: null,
    rootVars: vars,
  });
  const scopes = scopesOf(root);
  const adopted = importTargets(scopes);
  const nodes = entriesOf(root).map((scoped) =>
    nodeOf(scoped, build, vars, adopted)
  );
  const edges: EdgeModel[] = graphEdges(root);
  const providers: ProviderUse[] = providerUses(root, build.files, dir);
  return {
    stack,
    env,
    description: root.config.header,
    dir,
    nodes,
    edges,
    modules: moduleModels(root, nodes),
    providers,
    state: stateBackend(root),
    removed: removedModels(root),
    diagnostics: scopes.flatMap((s) => s.config.diagnostics),
  };
}

/** An env file, resolved as OpenTofu is handed it (`tofu-vars.ts`). */
function envVars(sources: TofuSources, file: string): Vars {
  return resolveEnvVars(jsonObject(sources, file)) as Vars;
}

function envModel(
  file: string,
  globalVars: Vars,
  sources: TofuSources,
  build: Build
): EnvModel {
  const values = envVars(sources, file);
  const vars: Vars = { ...globalVars, ...values };
  const env = text(values, 'env') ?? file;
  const hosts = (values['hosts'] ?? {}) as Record<string, string>;
  return {
    env,
    displayName: text(values, 'display_name') ?? env,
    suffix: text(values, 'suffix') ?? env,
    protection: text(values, 'protection') ?? 'standard',
    hosts,
    worker: text(values, 'worker', 'name'),
    stacks: STACKS.filter((s) => !GLOBAL_STACKS.includes(s)).map((stack) =>
      stackModel(stack, env, vars, build)
    ),
  };
}

export function buildInfraModel(sources: TofuSources): InfraModel {
  const files = sourceFiles(sources);
  const policy = sources.get(POLICY) ?? '';
  const build: Build = { files, deletable: parseDeletable(policy) };
  const globalVars = resolveGlobalVars(
    jsonObject(sources, `${TOFU}/global.tfvars.json`)
  ) as Vars;
  const envFiles = [...sources.keys()]
    .filter((p) => /^tofu\/envs\/[^/]+\.tfvars\.json$/.test(p))
    .sort();
  const envs = envFiles
    .map((file) => envModel(file, globalVars, sources, build))
    .sort((a, b) => rank(a) - rank(b) || compareText(a.env, b.env));
  // A global stack's second var file: every env file by name.
  const everyEnv: Vars = {
    ...globalVars,
    envs: Object.fromEntries(
      envFiles.map((file) => {
        const values = envVars(sources, file);
        return [text(values, 'env') ?? file, values];
      })
    ),
  };
  return {
    project: text(globalVars, 'project') ?? 'infrastructure',
    globals: GLOBAL_STACKS.map((stack) =>
      stackModel(stack, null, everyEnv, build)
    ),
    envs,
    vars: globalVars,
    sourceCount: sources.size,
  };
}

function rank(env: EnvModel): number {
  return env.protection === 'production' ? 0 : 1;
}
