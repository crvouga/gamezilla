/**
 * `specs/spaces/spaces.als` against what the product stores: the server's
 * database and every device's own copy, read after every step of the trace
 * of `specs/spaces/space-hosting.qnt` Quint draws that takes the most of the
 * actions that change a lobby, and during one scripted run with what that
 * model cannot draw: a person who is no friend of the host (see
 * `spaces-scenarios.ts`, and `spaces-projection.ts` for what is stored, what
 * is derived, and what is not stored at all). Both adapters read the same
 * runs.
 */

import '../quint/space-hosting.binding';

import { quintWalk, reaches } from '@libs/harness-ts/quint-walk';
import { captureWorlds, sharedWorlds } from '@libs/harness-ts/snapshot-worlds';
import { bindStructure } from '@pkgs/alloy-shared-ts/registry';

import { openHarness } from '../open-friends-harness';
import { projectSpaces } from './spaces-projection';
import { SPACES_SCENARIO } from './spaces-scenarios';

/**
 * The actions that put the lobby to the test: a space opens, a friend joins
 * it, its host steps out and returns, a friend leaves, and it ends.
 */
const STRESSED = [
  'createSpace',
  'join',
  'stepOut',
  'returnToSpace',
  'leave',
  'endSpace',
] as const;

const worlds = sharedWorlds('spaces', () =>
  captureWorlds(
    openHarness,
    [
      SPACES_SCENARIO,
      quintWalk({
        packageName: '@libs/friends',
        specUri: 'specs/spaces/space-hosting.qnt',
        maxSteps: 8,
        score: (trace) => reaches(trace, STRESSED) * 100 + trace.states.length,
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
