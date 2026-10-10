import { expect } from 'bun:test';

import { Given } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { renameSpace } from '@libs/spaces-harness/space-actions';
import { cancelRenameSpace } from '@libs/spaces-harness/space-name-rule-actions';
import { spaceNameRefusalShown } from '@libs/spaces-harness/spaces-ui-reads';

Given(
  '{actor} has tried to rename the space to {string} and been told it is not allowed',
  async (w, actor: Actor, name: string) => {
    await w.s.apply(renameSpace, actor, name);
    expect(await w.s.read(spaceNameRefusalShown, actor)).toBe(true);
    await w.s.apply(cancelRenameSpace, actor);
  }
);
