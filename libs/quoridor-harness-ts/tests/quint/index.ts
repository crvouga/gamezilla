import '@libs/harness-ts/platform';
import { useQuintHarness } from '@libs/harness-ts/quint-world';
import { openHarness } from '../open-quoridor-harness';

const modules = new Bun.Glob('*.binding.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);
useQuintHarness(openHarness);
