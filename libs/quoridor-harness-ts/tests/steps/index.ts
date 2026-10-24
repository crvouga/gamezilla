import '@libs/harness-ts/platform';
import { useHarnessWorld } from '@libs/harness-ts/spec-world';
import { openHarness } from '../open-quoridor-harness';

const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);
useHarnessWorld(openHarness);
