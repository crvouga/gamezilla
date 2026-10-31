// @io-wall-ok — projects the owning registry into the spec planner's generated inputs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { FEATURE_VARIANTS_PATH } from '@libs/harness-ts/feature-variants';
import { conformanceVariants, sharedSpecifications } from './conformance-world';

const path = join(import.meta.dirname, '..', FEATURE_VARIANTS_PATH);
const variants = Object.fromEntries(
  sharedSpecifications()
    .filter((uri) => uri.endsWith('.feature'))
    .map((uri) => [basename(uri), conformanceVariants(uri).length])
);
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, `${JSON.stringify(variants, null, 2)}\n`);
// Registry imports may own harness handles, but no world is opened.
process.exit(0);
