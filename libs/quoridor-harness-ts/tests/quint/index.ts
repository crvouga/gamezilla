import '@libs/harness-ts/platform';
import { useQuintHarness } from '@libs/harness-ts/quint-world';
import { defineTraceVariants } from '@pkgs/quint-shared-ts/registry';
import { openHarness } from '../open-quoridor-harness';

const modules = new Bun.Glob('*.binding.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);
defineTraceVariants(() => [
  { id: 'classic', label: 'Classic Quoridor', parameters: { HILL: false } },
  {
    id: 'hill',
    label: 'Four-Player King of the Hill',
    parameters: { HILL: true },
  },
]);
useQuintHarness(openHarness);
