import type { PuzzleFeedConfig } from '@libs/game-puzzle-shared-ts/feed-config';
import { type Accessor, createEffect, createSignal, untrack } from 'solid-js';
import type { PuzzleFeedConfigSetter } from './puzzle-feed-context';

/** Each opening previews a copy; edits never write the account's saved choices. */
export function createFeedSettingsDraft(
  saved: Accessor<PuzzleFeedConfig>,
  visible: Accessor<boolean>
): [Accessor<PuzzleFeedConfig>, PuzzleFeedConfigSetter] {
  const [draft, setDraft] = createSignal(untrack(saved));
  createEffect(() => {
    if (visible()) untrack(() => setDraft(saved()));
  });
  return [draft, setDraft];
}
