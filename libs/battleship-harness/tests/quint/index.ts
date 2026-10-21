/** Quint entry for `specs/battleship/*.qnt`: every binding, one world. */

import { useQuintHarness } from '@libs/harness/quint-world';
import { openHarness } from '../open-battleship-harness';

const modules = new Bun.Glob('**/*.binding.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useQuintHarness(openHarness);
