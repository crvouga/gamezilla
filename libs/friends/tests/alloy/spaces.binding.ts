/**
 * `specs/spaces/spaces.als` against what the product stores: the server's
 * database and every device's own copy, read back after each scripted
 * spaces scenario, and after every step of a few traces Quint draws from
 * `specs/spaces/space-hosting.qnt` (see `spaces-projection.ts` for what is
 * stored, what is derived, and what is not stored at all).
 */

import '../quint/space-hosting.binding';

import { bindStructure } from '@pkgs/alloy/registry';

import { openHarness } from '../harness/open-friends-harness';
import { quintWalks } from './snapshot-quint-walks';
import { captureWorlds, once } from './snapshot-worlds';
import { projectSpaces } from './spaces-projection';
import { SPACES_SCENARIOS } from './spaces-scenarios';

const worlds = once(() =>
  captureWorlds(
    openHarness,
    [
      ...SPACES_SCENARIOS,
      ...quintWalks({
        packageName: '@libs/friends',
        specUri: 'specs/spaces/space-hosting.qnt',
        traces: 2,
        maxSteps: 6,
      }),
    ],
    projectSpaces
  )
);

bindStructure({
  spec: 'spaces',
  snapshots: {
    'server database': async () => (await worlds()).server,
    'device database': async () => (await worlds()).device,
  },
});
