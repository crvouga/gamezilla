import { expect } from 'bun:test';
import { openPuzzleFeedSettings } from '@libs/chess/harness/chess-actions';
import { readFeedTargetLabel } from '@libs/chess/harness/chess-puzzle-feed-ui';
import {
  previewPuzzleFeedChoice,
  readSavedFeedChoice,
} from '@libs/chess/harness/puzzle-feed-model';
import { type Actor, Given, Then } from '@libs/harness/spec/define';

Given(
  '{actor} has chosen unsaved auto-advance after one second',
  async (w, actor: Actor) => {
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(previewPuzzleFeedChoice, actor, 'after one second');
  }
);
Then(
  "{actor}'s saved feed advances after one second",
  async (w, actor: Actor) => {
    expect(await w.s.read(readSavedFeedChoice, actor)).toBe('after one second');
  }
);
Then(
  "{actor}'s unsaved choices cannot replace saved feed choices without saving",
  async (w, actor: Actor) => {
    expect(await w.s.read(readFeedTargetLabel, actor)).toEqual({
      mode: 'auto',
      rating: 1500,
    });
  }
);
