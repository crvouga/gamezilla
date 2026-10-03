import { type Accessor, createEffect, createSignal, untrack } from 'solid-js';
import type { ChessPuzzleFeedConfig } from '../chess-puzzle-feed-config';
import type { ChessPuzzleFeedConfigSetter } from './chess-puzzle-feed-context';

/** Each opening previews a copy; edits never write the account's saved choices. */
export function createFeedSettingsDraft(
  saved: Accessor<ChessPuzzleFeedConfig>,
  visible: Accessor<boolean>
): [Accessor<ChessPuzzleFeedConfig>, ChessPuzzleFeedConfigSetter] {
  const [draft, setDraft] = createSignal(untrack(saved));
  createEffect(() => {
    if (visible()) untrack(() => setDraft(saved()));
  });
  return [draft, setDraft];
}
