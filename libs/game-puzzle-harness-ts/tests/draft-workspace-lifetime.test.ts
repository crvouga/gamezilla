import { expect, test } from 'bun:test';
import {
  arrangeContentDraft,
  changeContentMetadata,
} from '@libs/game-puzzle-harness-ts/content-actions';
import { currentSavedContentDraft } from '@libs/game-puzzle-harness-ts/content-observations';
import { contentSystem } from '@libs/game-puzzle-harness-ts/content-system';
import { saveMetadataThroughScreen } from '@libs/game-puzzle-harness-ts/metadata-screen-actions';

test('independent head and draft watch deliveries keep the pending editor alive', async () => {
  // regression: puzzle-autosave-remount-loses-next-field
  await using run = await contentSystem.run({ seed: 'f1dd5ec2c3fbf35d' });
  await run.apply(arrangeContentDraft, 'alice:phone', {
    title: 'River',
    valid: false,
  });
  await run.apply(changeContentMetadata, 'alice:phone', {
    description: 'Connect the riverbanks',
    difficulty: 'Gentle',
  });
  await run.apply(saveMetadataThroughScreen, 'alice:phone');
  expect(await run.read(currentSavedContentDraft, 'alice:phone')).toMatchObject(
    { description: 'Connect the riverbanks', difficulty: 'Gentle' }
  );
});
