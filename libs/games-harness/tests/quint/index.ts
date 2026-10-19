/**
 * Quint entry for the `specs/games/*.qnt` models: every model's binding,
 * each model replayed once for every conformance game offering what it shows
 * (`SHARED_SPECIFICATIONS`), named `<trace> [<game>]`, in a world where every
 * one of them is offered.
 */

import { useQuintHarness } from '@libs/harness/quint-world';
import { defineTraceVariants } from '@pkgs/quint-shared/registry';
import {
  conformanceVariants,
  declareRequiredGames,
  openConformanceHarness,
} from '../conformance-world';

defineTraceVariants(({ specUri }) => conformanceVariants(specUri));
declareRequiredGames();

// Every `*.binding.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.binding.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useQuintHarness(openConformanceHarness);
