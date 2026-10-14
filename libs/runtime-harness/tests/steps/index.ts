import '@libs/account-privacy-harness/privacy.steps';
/**
 * Steps entry for the `specs/<domain>/` features this package runs
 * (`specDomains`): registers the world (the full app
 * composition) and every step definition its features may use — the shared
 * platform steps and this package's own. The critical journeys' steps run
 * on {@link harnessJourneyHost} here and on a real browser in `@apps/product`.
 */

import '@libs/harness/platform';
import '@libs/profile-harness/profile.steps';
import '@libs/runtime-harness/journeys.steps';

import { useHarnessWorld } from '@libs/harness/spec-world';
import { openHarness } from '../open-app-harness';
import { harnessJourneyHost } from './journey-harness-host';

// New local step modules register themselves without editing this entry.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useHarnessWorld(openHarness, (w) => ({ journey: harnessJourneyHost(w) }));
