import '@libs/account-privacy-harness-ts/privacy.steps';
/**
 * Steps entry for the `specs/<domain>/` features this package runs
 * (`specDomains`): registers the world (billing on the
 * platform alone) and every step definition its features may use — the
 * shared platform steps and this package's own.
 */

import '@libs/harness-ts/platform';

import { privacyTimePasses } from '@libs/account-privacy-harness-ts/privacy-actions';
import {
  makeMembershipPayment,
  pauseCancellation,
} from '@libs/billing-harness-ts/account-privacy';
import {
  openBilling,
  subscribeToPlus,
} from '@libs/billing-harness-ts/billing-actions';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { useHarnessWorld } from '@libs/harness-ts/spec-world';
import { openHarness } from '../open-billing-harness';

// Every `*.steps.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

// Exported steps belong to this package and register alongside its private steps.
const exported = new Bun.Glob('../../src/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...exported].sort()) await import(`./${file}`);

useHarnessWorld(openHarness, (w) => ({
  beforeAccountDeletion: async (
    actor: Actor,
    completion: 'confirmed' | 'completed'
  ) => {
    await w.s.apply(signInWithGoogle, actor);
    await w.s.apply(openBilling, actor);
    await w.s.apply(subscribeToPlus, actor);
    await w.s.apply(privacyTimePasses, 7 * 86_400_000 + 1_000);
    await w.s.apply(
      makeMembershipPayment,
      String(await w.s.read(signedInAccountOf, actor))
    );
    if (completion === 'confirmed') await w.s.apply(pauseCancellation);
  },
}));

import { signedInAccountOf } from '@libs/harness-ts/identity';
