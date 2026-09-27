/**
 * Only the host drives a watched puzzle. A watcher's forged move or skip,
 * sent straight to the room, is refused as unauthorized; the host keeps
 * solving and both boards still agree. The Gherkin keeps the part a person
 * sees ("the watcher cannot move pieces"); this pins the room's refusal.
 */

import { describe, expect, test } from 'bun:test';
import { openPuzzleFromSpace } from '@libs/chess/sim/chess-actions';
import {
  attemptHostPuzzleCommand,
  readPuzzleCommandOutcome,
} from '@libs/chess/sim/chess-puzzle-room-probe';
import {
  readPuzzleDisplayFen,
  readPuzzleStatus,
} from '@libs/chess/sim/chess-puzzle-ui';
import {
  focusActor,
  returnToTabs,
  signInWithGoogle,
  spawnActor,
} from '@libs/sim-harness';
import {
  createSpace,
  joinFromPrompt,
  openSpaceLink,
} from '@libs/spaces/sim/space-actions';
import { readSpaceLink } from '@libs/spaces/sim/spaces-ui-reads';
import { ROOM_ERROR_TYPE } from '@pkgs/room';
import { type OpenSim, openSim } from './support/open-chess-sim';

async function watchedPuzzle(s: OpenSim): Promise<void> {
  for (const actor of ['alice', 'bob']) {
    await s.apply(spawnActor, actor);
    await s.apply(signInWithGoogle, actor);
    await s.apply(returnToTabs, actor);
  }
  await s.apply(focusActor, 'alice');
  await s.apply(createSpace, 'alice');
  const link = await s.read(readSpaceLink, 'alice');
  if (link === null) throw new Error('alice is not in a space');
  await s.apply(openSpaceLink, 'bob', link);
  await s.apply(joinFromPrompt, 'bob');
  await s.apply(focusActor, 'alice');
  await s.apply(openPuzzleFromSpace, 'alice');
  await s.apply(focusActor, 'bob');
  await s.until(async (surf) => readPuzzleStatus(surf, 'bob'), {
    maxMs: 20_000,
    pred: (status) => status === 'solving',
  });
}

describe('a watcher cannot drive the host puzzle', () => {
  for (const command of ['move', 'skip'] as const) {
    test(`a watcher's ${command} is refused as unauthorized`, async () => {
      await using s = await openSim(`watcher-command-refused-${command}`);
      await watchedPuzzle(s);

      await s.apply(focusActor, 'alice');
      await s.apply(attemptHostPuzzleCommand, 'bob', 'alice', command);
      const outcome = await s.read(readPuzzleCommandOutcome, 'bob');
      expect(outcome?.kind).toBe('refused');
      if (outcome?.kind === 'refused') {
        expect(outcome.error.type).toBe(ROOM_ERROR_TYPE.unauthorized);
      }

      expect(await s.read(readPuzzleStatus, 'alice')).toBe('solving');
      const hostFen = await s.read(readPuzzleDisplayFen, 'alice');
      expect(hostFen).not.toBeNull();
      await s.apply(focusActor, 'bob');
      await s.until(async (surf) => readPuzzleDisplayFen(surf, 'bob'), {
        maxMs: 20_000,
        pred: (fen) => fen === hostFen,
      });
    });
  }
});
