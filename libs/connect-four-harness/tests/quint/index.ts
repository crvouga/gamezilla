/** Quint entry for `specs/connect-four/*.qnt`: every binding, one world. */

import { useQuintHarness } from '@libs/harness/quint-world';
import { openHarness } from '../open-connect-four-harness';

const modules = new Bun.Glob('**/*.binding.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useQuintHarness(openHarness);
