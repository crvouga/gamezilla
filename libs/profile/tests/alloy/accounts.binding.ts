/**
 * `specs/profile/accounts.als` against what the product stores: the server's
 * database and every device's own copy, read after every step of the trace
 * of `specs/profile/account-sign-in.qnt` Quint draws that takes the most of
 * the actions that change sign-in methods and devices, and during one
 * scripted run with what that model cannot draw: renames, and an only Apple
 * account deleted at Apple (see `accounts-scenarios.ts` and
 * `accounts-projection.ts`). Both adapters read the same runs.
 */

import '../quint/account-sign-in.binding';

import { quintWalk, reaches } from '@libs/harness/alloy/quint-walk';
import {
  captureWorlds,
  sharedWorlds,
} from '@libs/harness/alloy/snapshot-worlds';
import { bindStructure } from '@pkgs/alloy/registry';

import { openHarness } from '../harness/open-profile-harness';
import { projectAccounts } from './accounts-projection';
import { ACCOUNTS_SCENARIO } from './accounts-scenarios';

/** The actions that change an account's sign-in methods and devices. */
const STRESSED = [
  'signIn',
  'connectSignInMethod',
  'removeSignInMethod',
  'signOut',
  'signOutEverywhere',
] as const;

const worlds = sharedWorlds('accounts', () =>
  captureWorlds(
    openHarness,
    [
      ACCOUNTS_SCENARIO,
      quintWalk({
        packageName: '@libs/profile',
        specUri: 'specs/profile/account-sign-in.qnt',
        maxSteps: 8,
        score: (trace) => reaches(trace, STRESSED) * 100 + trace.states.length,
      }),
    ],
    projectAccounts
  )
);

bindStructure({
  spec: 'accounts',
  snapshots: {
    'server database': async () => (await worlds()).server,
    'device database': async () => (await worlds()).device,
  },
});
