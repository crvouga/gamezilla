/**
 * Instantiate configuration as a tree of scopes, one per module instance,
 * each with lazily evaluated variables, locals, outputs and resource
 * attributes. Nothing here needs a provider or state; unknowns stay unknown.
 */

import type { Block, Body, Expr } from './hcl-ast';
import { literalString } from './hcl-ast';
import type { Env } from './hcl-eval';
import { evaluate } from './hcl-eval';
import { convertToType } from './hcl-types';
import type { Value } from './hcl-value';
import {
  defineLazy,
  isList,
  isObject,
  isUnknown,
  sortedKeys,
  stringify,
  UNKNOWN,
} from './hcl-value';
import type { LoadedConfig, Located } from './infra-config';
import { loadConfig } from './infra-config';
import type { SourceFiles } from './infra-source';
import { joinPath } from './infra-source';

export type Expansion = 'single' | 'count' | 'for_each' | 'unknown';

export type ResourceInstance = {
  readonly key: string | number | null;
  readonly attrs: Readonly<Record<string, Value>>;
};

export type Expanded = {
  readonly expansion: Expansion;
  readonly instances: readonly ResourceInstance[];
  readonly value: Value;
};

export type ResourceEntry = {
  readonly mode: 'managed' | 'data';
  readonly type: string;
  readonly name: string;
  /** Stack-relative address, e.g. `module.pubsub.aws_iam_role.authorizer`. */
  readonly address: string;
  readonly file: string;
  readonly line: number;
  readonly body: Body;
  readonly preventDestroy: boolean;
  expand(): Expanded;
};

export type Scope = {
  readonly id: string;
  readonly dir: string;
  readonly path: readonly string[];
  readonly config: LoadedConfig;
  readonly env: Env;
  readonly parent: Scope | null;
  /** Module-call arguments by variable name, evaluated in the parent. */
  readonly args: ReadonlyMap<string, Expr>;
  readonly children: ReadonlyMap<string, Scope>;
  readonly resources: readonly ResourceEntry[];
  readonly outputs: Readonly<Record<string, Value>>;
};

export type BuildInput = {
  readonly files: SourceFiles;
  readonly dir: string;
  readonly path: readonly string[];
  readonly parent: Scope | null;
  readonly call: Body | null;
  readonly rootVars: Readonly<Record<string, Value>>;
};

const META_ARGUMENTS = new Set([
  'source',
  'providers',
  'count',
  'for_each',
  'depends_on',
  'version',
]);

export function addressPrefix(path: readonly string[]): string {
  return path.map((segment) => `module.${segment}.`).join('');
}

function withNames(env: Env, extra: Record<string, Value>): Env {
  return { names: { ...env.names, ...extra }, files: env.files };
}

/** Attributes (and nested blocks) of a body as lazily evaluated values. */
export function attrsObject(body: Body, env: Env): Record<string, Value> {
  const out: Record<string, Value> = {};
  const grouped = new Map<string, Block[]>();
  for (const block of body.blocks) {
    if (block.type === 'lifecycle' || block.type === 'dynamic') continue;
    grouped.set(block.type, [...(grouped.get(block.type) ?? []), block]);
  }
  for (const [type, blocks] of grouped) {
    defineLazy(out, type, () => blocks.map((b) => attrsObject(b.body, env)));
  }
  for (const [name, expr] of body.attributes) {
    defineLazy(out, name, () => evaluate(expr, env));
  }
  return out;
}

function snapshot(attrs: Record<string, Value>): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const key of Object.keys(attrs)) out[key] = attrs[key] as Value;
  return out;
}

function eachKeys(collection: Value): { key: string; value: Value }[] | null {
  if (isUnknown(collection)) return null;
  if (isList(collection)) {
    return collection.map((item) => ({ key: stringify(item), value: item }));
  }
  if (isObject(collection)) {
    return sortedKeys(collection).map((key) => ({
      key,
      value: (collection as Record<string, Value>)[key] as Value,
    }));
  }
  return null;
}

function expandBody(body: Body, env: Env): Expanded {
  const countExpr = body.attributes.get('count');
  const forEachExpr = body.attributes.get('for_each');
  if (countExpr !== undefined) {
    const n = evaluate(countExpr, env);
    if (typeof n !== 'number') return unknownExpansion();
    const instances = Array.from({ length: n }, (_, index) => ({
      key: index as string | number | null,
      attrs: attrsObject(body, withNames(env, { count: { index } })),
    }));
    return {
      expansion: 'count',
      instances,
      value: instances.map((i) => i.attrs),
    };
  }
  if (forEachExpr !== undefined) {
    const entries = eachKeys(evaluate(forEachExpr, env));
    if (entries === null) return unknownExpansion();
    const map: Record<string, Value> = {};
    const instances = entries.map(({ key, value }) => {
      const attrs = attrsObject(body, withNames(env, { each: { key, value } }));
      map[key] = attrs;
      return { key: key as string | number | null, attrs };
    });
    return { expansion: 'for_each', instances, value: map };
  }
  const attrs = attrsObject(body, env);
  return {
    expansion: 'single',
    instances: [{ key: null, attrs }],
    value: attrs,
  };
}

function unknownExpansion(): Expanded {
  return { expansion: 'unknown', instances: [], value: UNKNOWN };
}

function preventsDestroy(body: Body): boolean {
  const lifecycle = body.blocks.find((b) => b.type === 'lifecycle');
  const flag = lifecycle?.body.attributes.get('prevent_destroy');
  return flag?.kind === 'literal' && flag.value === true;
}

function makeEntry(
  located: Located<Block>,
  mode: 'managed' | 'data',
  prefix: string,
  env: Env
): ResourceEntry {
  const [type = '', name = ''] = located.value.labels;
  let cached: Expanded | null = null;
  const body = located.value.body;
  return {
    mode,
    type,
    name,
    address: `${prefix}${mode === 'data' ? 'data.' : ''}${type}.${name}`,
    file: located.file,
    line: located.value.line,
    body,
    preventDestroy: preventsDestroy(body),
    expand: () => {
      if (cached === null) {
        const expanded = expandBody(body, env);
        cached = {
          ...expanded,
          instances: expanded.instances.map((i) => ({
            key: i.key,
            attrs: snapshot(i.attrs as Record<string, Value>),
          })),
        };
      }
      return cached;
    },
  };
}

function bindResources(
  entries: readonly ResourceEntry[],
  names: Record<string, Value>
): void {
  const data: Record<string, Value> = {};
  names['data'] = data;
  const groups = new Map<string, Record<string, Value>>();
  for (const entry of entries) {
    const root = entry.mode === 'data' ? data : names;
    let group = groups.get(`${entry.mode}:${entry.type}`);
    if (group === undefined) {
      group = {};
      groups.set(`${entry.mode}:${entry.type}`, group);
      root[entry.type] = group;
    }
    defineLazy(group, entry.name, () => entry.expand().value);
  }
}

function variableValue(
  name: string,
  block: Block,
  input: BuildInput,
  env: Env
): Value {
  let raw: Value = UNKNOWN;
  if (input.call !== null && input.parent !== null) {
    const arg = input.call.attributes.get(name);
    const fallback = block.body.attributes.get('default');
    if (arg !== undefined) raw = evaluate(arg, input.parent.env);
    else if (fallback !== undefined) raw = evaluate(fallback, env);
  } else {
    const provided = input.rootVars[name];
    const fallback = block.body.attributes.get('default');
    if (provided !== undefined) raw = provided;
    else if (fallback !== undefined) raw = evaluate(fallback, env);
  }
  const type = block.body.attributes.get('type');
  return type === undefined ? raw : convertToType(type, raw, env);
}

function buildChildren(
  input: BuildInput,
  config: LoadedConfig,
  self: Scope
): Map<string, Scope> {
  const children = new Map<string, Scope>();
  for (const { value: block } of config.modules) {
    const [name] = block.labels;
    const source = literalString(block.body.attributes.get('source'));
    if (name === undefined || source === null || !source.startsWith('.')) {
      continue;
    }
    children.set(
      name,
      buildScope({
        files: input.files,
        dir: joinPath(input.dir, source),
        path: [...input.path, name],
        parent: self,
        call: block.body,
        rootVars: {},
      })
    );
  }
  return children;
}

type MutableScope = { -readonly [K in keyof Scope]: Scope[K] };

export function buildScope(input: BuildInput): Scope {
  const config = loadConfig(input.files, input.dir);
  const vars: Record<string, Value> = {};
  const locals: Record<string, Value> = {};
  const modules: Record<string, Value> = {};
  const names: Record<string, Value> = {
    var: vars,
    local: locals,
    module: modules,
    path: { module: input.dir, root: '', cwd: '' },
  };
  const env: Env = { names, files: input.files };
  const prefix = addressPrefix(input.path);
  const resources = [
    ...config.resources.map((r) => makeEntry(r, 'managed', prefix, env)),
    ...config.data.map((r) => makeEntry(r, 'data', prefix, env)),
  ];
  bindResources(resources, names);
  for (const [name, { value: block }] of config.variables) {
    defineLazy(vars, name, () => variableValue(name, block, input, env));
  }
  for (const [name, { value: expr }] of config.locals) {
    defineLazy(locals, name, () => evaluate(expr, env));
  }
  const outputs: Record<string, Value> = {};
  for (const [name, { value: block }] of config.outputs) {
    const expr = block.body.attributes.get('value');
    if (expr !== undefined)
      defineLazy(outputs, name, () => evaluate(expr, env));
  }
  const args = new Map<string, Expr>();
  for (const [name, expr] of input.call?.attributes ?? []) {
    if (!META_ARGUMENTS.has(name)) args.set(name, expr);
  }
  const scope: MutableScope = {
    id: [...input.path].join('.') || '(root)',
    dir: input.dir,
    path: input.path,
    config,
    env,
    parent: input.parent,
    args,
    children: new Map(),
    resources,
    outputs,
  };
  scope.children = buildChildren(input, config, scope);
  for (const [name, child] of scope.children) modules[name] = child.outputs;
  return scope;
}
