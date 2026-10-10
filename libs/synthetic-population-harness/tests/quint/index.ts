import '@libs/harness/platform';
import { useQuintHarness } from '@libs/harness/quint-world';
import { openHarness } from '../open-synthetic-population-harness';

const files = new Bun.Glob('*.binding.ts').scanSync(import.meta.dir);
for (const file of [...files].sort()) await import(`./${file}`);
useQuintHarness(openHarness);
