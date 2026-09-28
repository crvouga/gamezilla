/**
 * `specs/profile/accounts.als` against what the product stores: the server's
 * database and every device's own copy, read back during and after each
 * scripted accounts scenario, and after every step of a few traces Quint
 * draws from `specs/profile/account-sign-in.qnt` and
 * `specs/profile/username-changes.qnt` (see `accounts-projection.ts`).
 */

import '../quint/account-sign-in.binding';
import '../quint/username-changes.binding';

import { bindStructure } from '@pkgs/alloy/registry';

import { openHarness } from '../harness/open-profile-harness';
import { projectAccounts } from './accounts-projection';
import { ACCOUNTS_SCENARIOS } from './accounts-scenarios';
import { quintWalks } from './snapshot-quint-walks';
import { captureWorlds, once } from './snapshot-worlds';

const WALKS = { packageName: '@libs/profile', traces: 2, maxSteps: 6 };

const worlds = once(() =>
  captureWorlds(
    openHarness,
    [
      ...ACCOUNTS_SCENARIOS,
      ...quintWalks({ ...WALKS, specUri: 'specs/profile/account-sign-in.qnt' }),
      ...quintWalks({
        ...WALKS,
        specUri: 'specs/profile/username-changes.qnt',
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
