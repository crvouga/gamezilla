// @io-wall-ok — reads the manifest and decision tables from the repo's specs/.
/**
 * The specs this package's closed-world and mutation tests hold the
 * permission system to: the conformance manifest's capabilities and every
 * decision table, read from the repository (turbo hashes them as inputs).
 */

import { join, resolve } from 'node:path';
import type { DmnDecision } from '@pkgs/dmn-shared-ts/model';
import { findDecision, parseDmn } from '@pkgs/dmn-shared-ts/model';

const REPO_ROOT = resolve(import.meta.dir, '../../..');
const SPECS_DIR = join(REPO_ROOT, 'specs');

export type ManifestCapability = {
  readonly id: string;
  readonly context: string;
  readonly 'decided by': string;
};

type Manifest = {
  readonly product: { readonly capabilities: readonly ManifestCapability[] };
};

/** `product.capabilities` of `specs/conformance.yaml`. */
export async function manifestCapabilities(): Promise<
  readonly ManifestCapability[]
> {
  const text = await Bun.file(join(SPECS_DIR, 'conformance.yaml')).text();
  const manifest = Bun.YAML.parse(text) as Manifest;
  return manifest.product.capabilities;
}

/** Every decision of every `specs/<domain>/*.dmn`. */
export async function allDecisions(): Promise<readonly DmnDecision[]> {
  const paths = [...new Bun.Glob('*/*.dmn').scanSync({ cwd: SPECS_DIR })];
  const decisions: DmnDecision[] = [];
  for (const path of paths.sort()) {
    const parsed = parseDmn(await Bun.file(join(SPECS_DIR, path)).text());
    if (!parsed.ok) throw new Error(`${path}: ${parsed.issues.join('; ')}`);
    decisions.push(...parsed.definitions.decisions);
  }
  return decisions;
}

/** Decision `id` of `specs/<path>`. */
export async function decisionAt(
  path: string,
  id: string
): Promise<DmnDecision> {
  const parsed = parseDmn(await Bun.file(join(SPECS_DIR, path)).text());
  if (!parsed.ok) throw new Error(`${path}: ${parsed.issues.join('; ')}`);
  const decision = findDecision(parsed.definitions, id);
  if (decision === undefined) throw new Error(`${path} has no ${id}`);
  return decision;
}
