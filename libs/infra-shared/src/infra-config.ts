/**
 * One directory of `.tf` files, parsed and sorted into the block kinds the
 * model cares about. A file that does not parse is reported, never thrown:
 * the map still renders and the report names the file.
 */

import type { Block, Expr } from './hcl-ast';
import { parseConfig } from './hcl-parse';
import type { SourceFiles } from './infra-source';
import { basenameOf } from './infra-source';

export type Located<T> = { readonly value: T; readonly file: string };

export type Diagnostic = { readonly file: string; readonly message: string };

export type LoadedConfig = {
  readonly dir: string;
  readonly variables: ReadonlyMap<string, Located<Block>>;
  readonly locals: ReadonlyMap<string, Located<Expr>>;
  readonly outputs: ReadonlyMap<string, Located<Block>>;
  readonly resources: readonly Located<Block>[];
  readonly data: readonly Located<Block>[];
  readonly modules: readonly Located<Block>[];
  readonly imports: readonly Located<Block>[];
  readonly removed: readonly Located<Block>[];
  readonly terraform: readonly Located<Block>[];
  readonly diagnostics: readonly Diagnostic[];
  /** The leading comment of `main.tf`: what the directory is for. */
  readonly header: string;
};

/** The comment block at the top of a file, without comment markers. */
export function leadingComment(source: string): string {
  const lines: string[] = [];
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('#')) break;
    lines.push(line.replace(/^#\s?/, ''));
  }
  return lines.join('\n').trim();
}

type Mutable = {
  variables: Map<string, Located<Block>>;
  locals: Map<string, Located<Expr>>;
  outputs: Map<string, Located<Block>>;
  resources: Located<Block>[];
  data: Located<Block>[];
  modules: Located<Block>[];
  imports: Located<Block>[];
  removed: Located<Block>[];
  terraform: Located<Block>[];
};

function sortBlock(into: Mutable, block: Block, file: string): void {
  const located = { value: block, file };
  const [first] = block.labels;
  switch (block.type) {
    case 'variable':
      if (first !== undefined) into.variables.set(first, located);
      return;
    case 'output':
      if (first !== undefined) into.outputs.set(first, located);
      return;
    case 'locals':
      for (const [name, expr] of block.body.attributes) {
        into.locals.set(name, { value: expr, file });
      }
      return;
    case 'resource':
      into.resources.push(located);
      return;
    case 'data':
      into.data.push(located);
      return;
    case 'module':
      into.modules.push(located);
      return;
    case 'import':
      into.imports.push(located);
      return;
    case 'removed':
      into.removed.push(located);
      return;
    case 'terraform':
      into.terraform.push(located);
      return;
    default:
  }
}

export function loadConfig(files: SourceFiles, dir: string): LoadedConfig {
  const into: Mutable = {
    variables: new Map(),
    locals: new Map(),
    outputs: new Map(),
    resources: [],
    data: [],
    modules: [],
    imports: [],
    removed: [],
    terraform: [],
  };
  const diagnostics: Diagnostic[] = [];
  let header = '';
  for (const path of files.list(dir, '.tf')) {
    const text = files.read(path) ?? '';
    if (basenameOf(path) === 'main.tf') header = leadingComment(text);
    try {
      for (const block of parseConfig(text).blocks) {
        sortBlock(into, block, path);
      }
    } catch (error) {
      diagnostics.push({
        file: path,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { dir, ...into, diagnostics, header };
}
