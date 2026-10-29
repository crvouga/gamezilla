/**
 * What the synthetic rebrand checks after the copy's identity changed: the
 * old brand's display names and domain must not survive anywhere outside the
 * identity package, except inside the external identifiers that keep their
 * value through a rebrand on purpose.
 */
import type { ProductIdentity } from '@libs/product-identity-shared-ts/product-identity';
import { IDENTITY_DIR, type ScannedFile } from './brand-policy';

export type Trace = {
  readonly path: string;
  readonly line: number;
  readonly spelling: string;
};

/** External identifiers, longest first: removed from text before matching. */
function externalValues(identity: ProductIdentity): string[] {
  const { external } = identity;
  return [
    external.appleBundleId,
    external.deepLinkScheme,
    external.sourceRepository,
    ...external.previousSourceRepositories,
    external.planetscaleOrganization,
    external.sentryOrganization,
    ...external.githubEnvironments,
  ].sort((a, b) => b.length - a.length);
}

/**
 * Every place the old brand's name (case-sensitive: the technical namespace
 * may share its letters in lower case) or its domain (any case) remains.
 */
export function oldBrandTraces(
  files: readonly ScannedFile[],
  old: ProductIdentity
): Trace[] {
  const names = [...new Set([old.brand.name, old.brand.shortName])];
  const domain = old.brand.domain.toLowerCase();
  const external = externalValues(old);
  const out: Trace[] = [];
  for (const file of files) {
    if (file.text === null || file.path.startsWith(IDENTITY_DIR)) continue;
    const lines = file.text.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      let line = lines[index] ?? '';
      for (const value of external) line = line.replaceAll(value, '');
      const spelling =
        names.find((name) => line.includes(name)) ??
        (line.toLowerCase().includes(domain) ? domain : undefined);
      if (spelling !== undefined)
        out.push({ path: file.path, line: index + 1, spelling });
    }
  }
  return out;
}
