import { expect } from 'bun:test';

import { Given } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { renameSpace } from '@libs/spaces-harness-ts/space-actions';
import { cancelRenameSpace } from '@libs/spaces-harness-ts/space-name-rule-actions';
import { spaceNameRefusalShown } from '@libs/spaces-harness-ts/spaces-ui-reads';

Given(
  '{actor} has tried to rename the space to {string} and been told it is not allowed',
  async (w, actor: Actor, name: string) => {
    await w.s.apply(renameSpace, actor, name);
    expect(await w.s.read(spaceNameRefusalShown, actor)).toBe(true);
    await w.s.apply(cancelRenameSpace, actor);
  }
);
