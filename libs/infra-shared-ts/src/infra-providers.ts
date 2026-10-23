/**
 * Providers a stack pins: the constraint from `required_providers` and the
 * version the committed `.terraform.lock.hcl` resolved.
 */

import { literalString } from './hcl-ast';
import { parseConfig } from './hcl-parse';
import { compareText } from './hcl-value';
import type { ProviderUse } from './infra-model-types';
import type { Scope } from './infra-scope';
import type { SourceFiles } from './infra-source';

function lockedVersions(files: SourceFiles, dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const raw = files.read(`${dir}/.terraform.lock.hcl`);
  if (raw === undefined) return out;
  try {
    for (const block of parseConfig(raw).blocks) {
      const source = block.labels[0];
      const version = literalString(block.body.attributes.get('version'));
      if (
        block.type === 'provider' &&
        source !== undefined &&
        version !== null
      ) {
        out.set(source.replace(/^registry\.[^/]+\//, ''), version);
      }
    }
  } catch {
    return out;
  }
  return out;
}

export function providerUses(
  root: Scope,
  files: SourceFiles,
  dir: string
): ProviderUse[] {
  const locked = lockedVersions(files, dir);
  const out: ProviderUse[] = [];
  for (const { value: terraform } of root.config.terraform) {
    const required = terraform.body.blocks.find(
      (b) => b.type === 'required_providers'
    );
    if (required === undefined) continue;
    for (const [name, expr] of required.body.attributes) {
      if (expr.kind !== 'object') continue;
      const field = (key: string): string | null => {
        const entry = expr.entries.find(
          (e) => e.key.kind === 'literal' && e.key.value === key
        );
        return entry === undefined ? null : literalString(entry.value);
      };
      const source = field('source');
      out.push({
        name,
        source,
        constraint: field('version'),
        locked: source === null ? null : (locked.get(source) ?? null),
      });
    }
  }
  return out.sort((a, b) => compareText(a.name, b.name));
}
