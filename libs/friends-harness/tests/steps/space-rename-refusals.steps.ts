/**
 * A rename the host's device accepted offline, refused once the connection
 * comes back: the space screen says so in an inline notice.
 */

import { expect } from 'bun:test';
import { Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import { refusedChangeShown } from '@libs/harness/shell-notices';

const RENAME = 'renameSpace';
const NOT_ALLOWED = 'SPACE_TITLE_NOT_ALLOWED';
const TOLD_WITHIN_MS = 15_000;

Then(
  '{actor} is told renaming the space was refused because that space name is not allowed',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    const told = await w.s.until((s) => refusedChangeShown(s, actor), {
      pred: (shown) => shown !== null,
      maxMs: TOLD_WITHIN_MS,
    });
    expect(told).toEqual({ change: RENAME, reason: NOT_ALLOWED });
  }
);

Then(
  '{actor} is not told renaming the space was refused',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    expect((await w.s.read(refusedChangeShown, actor))?.change).not.toBe(
      RENAME
    );
  }
);
