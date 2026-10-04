/** Profile acceptance steps and shared platform setup. */

import '@libs/harness/platform';
import { useHarnessWorld } from '@libs/harness/spec-world';
import { openHarness } from '../open-profile-harness';
import '@libs/account-privacy-harness/privacy.steps';
import '@libs/account-privacy-harness/exports.steps';

// Every `*.steps.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useHarnessWorld(openHarness);
