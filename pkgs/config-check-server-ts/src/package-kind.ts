/**
 * The four kinds of package, read from where a package lives.
 *
 * A package cannot choose its kind: it is its tier directory, and the design
 * system is the one named package. Every preset, expected config file and
 * pattern rule is keyed off this, so no package can opt into weaker rules.
 */

export const PACKAGE_KINDS = ['app', 'lib', 'pkg', 'ui'] as const;
export type PackageKind = (typeof PACKAGE_KINDS)[number];

/** The design system: the only package that paints. */
export const UI_PACKAGE_DIR = 'pkgs/ui-root-client-ts';
export const UI_PACKAGE_NAME = '@pkgs/ui-root-client-ts';

const TIER_KIND: Readonly<Record<string, PackageKind>> = {
  apps: 'app',
  libs: 'lib',
  pkgs: 'pkg',
};

/** `libs/auth-client-ts` -> `lib`; undefined outside the three tiers. */
export function packageKind(packageDir: string): PackageKind | undefined {
  const parts = packageDir.split('/');
  if (parts.length !== 2) return undefined;
  if (packageDir === UI_PACKAGE_DIR) return 'ui';
  return TIER_KIND[parts[0] ?? ''];
}

/** Kinds that compose the design system and never touch the platform. */
export function isComposer(kind: PackageKind): boolean {
  return kind === 'app' || kind === 'lib';
}
