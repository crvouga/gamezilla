import '@libs/harness/platform';
import { useHarnessWorld } from '@libs/harness/spec-world';
import { openHarness } from '../open-population-harness';

const files = new Bun.Glob('*.steps.ts').scanSync(import.meta.dir);
for (const file of [...files].sort()) await import(`./${file}`);
useHarnessWorld(openHarness);
