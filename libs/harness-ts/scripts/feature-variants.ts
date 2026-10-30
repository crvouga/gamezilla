// @io-wall-ok — reads a suite's generated scenario expansion plan.
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { SLICE_SCENARIOS, type SpecUnit, specWeight } from './spec-parts';

export const FEATURE_VARIANTS_PATH = '.cache/feature-variants.json';
export type FeatureVariants = Readonly<Record<string, number>>;

/** Suites opt in by owning the generator; missing output must never undercount. */
export function readFeatureVariants(
  packageDir: string
): FeatureVariants | null {
  const manifestPath = join(packageDir, 'package.json');
  if (!existsSync(manifestPath)) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    scripts?: Record<string, string>;
  };
  if (manifest.scripts?.['generate:feature-variants'] === undefined)
    return null;
  const path = join(packageDir, FEATURE_VARIANTS_PATH);
  if (!existsSync(path))
    throw new Error(
      `${path}: run bun spec:inputs to generate feature variants`
    );
  return JSON.parse(readFileSync(path, 'utf8')) as FeatureVariants;
}

/** Every source scenario stays intact, with all of its registered variants. */
export function variantFeatureUnits(
  path: string,
  source: string,
  plan: FeatureVariants
): readonly SpecUnit[] {
  const variants = plan[basename(path)];
  if (variants === undefined || !Number.isInteger(variants) || variants < 1)
    throw new Error(
      `${path}: missing or invalid feature variants; run bun spec:inputs`
    );
  const scenarios = specWeight(path, source);
  const perFile = Math.max(1, Math.floor(SLICE_SCENARIOS / variants));
  const count = Math.ceil(scenarios / perFile);
  return Array.from({ length: count }, (_, index) => ({
    path,
    ...(count === 1 ? {} : { slice: { index, count } }),
    variants,
    weight:
      (Math.floor(scenarios / count) + (index < scenarios % count ? 1 : 0)) *
      variants,
  }));
}
