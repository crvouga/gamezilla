import { expect, test } from 'bun:test';
import { chooseContentGame } from '@libs/game-puzzle-harness-ts/content-actions';
import { currentSavedContentDraft } from '@libs/game-puzzle-harness-ts/content-observations';
import { createContentThroughScreen } from '@libs/game-puzzle-harness-ts/content-screen-actions';
import { contentSystem } from '@libs/game-puzzle-harness-ts/content-system';

// regression: puzzle-reference-missing-auth-context
test('a cold authoring screen can render its permission states while the saved draft arrives', async () => {
  await using run = await contentSystem.run({ seed: '673b567911102359' });
  await run.apply(chooseContentGame, 'alice:phone');
  await run.apply(createContentThroughScreen, 'alice:phone', 'River');
  expect(await run.read(currentSavedContentDraft, 'alice:phone')).toMatchObject(
    { title: 'River' }
  );
});
