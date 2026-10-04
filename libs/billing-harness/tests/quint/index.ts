/**
 * Quint entry for the `specs/<domain>/*.qnt` models this package runs
 * (`specDomains`): registers the world (billing's lifecycle composition, whose
 * standing properties every model step is checked against) and every model's
 * binding.
 */

import { useQuintHarness } from '@libs/harness/quint-world';
import { openLifecycleHarness } from '../open-billing-lifecycle-harness';

// Every `*.binding.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.binding.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useQuintHarness(openLifecycleHarness);
