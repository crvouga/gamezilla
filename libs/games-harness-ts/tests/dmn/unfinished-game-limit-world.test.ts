import { expect, test } from 'bun:test';
import { PROFILE_TABLES } from '@libs/profile-shared-ts/tables';
import { MULTIPLAYER_LIMIT_TABLES } from './unfinished-game-limit-world';

// regression: unfinished-game-limit-no-profile-table
test('the unfinished-game-limit server world holds the profile table a search reads', () => {
  for (const table of PROFILE_TABLES)
    expect(MULTIPLAYER_LIMIT_TABLES).toContain(table);
});
