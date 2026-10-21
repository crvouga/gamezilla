import '@libs/harness-ts/platform';
import { useHarnessWorld } from '@libs/harness-ts/spec-world';
import { openHarness } from '../open-synthetic-population-harness';

const files = new Bun.Glob('*.steps.ts').scanSync(import.meta.dir);
for (const file of [...files].sort()) await import(`./${file}`);
useHarnessWorld(openHarness);
