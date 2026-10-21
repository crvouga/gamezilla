import { RefusedChangeNotice } from '@libs/app-root-client-ts/refused-change-notice';
import { savePuzzleFeedSettingsMutation } from '@libs/game-puzzle-shared-ts/save-puzzle-feed-settings-mutation';
import type { JSX } from 'solid-js';

const FEED_SETTINGS_CHANGES: readonly string[] = [
  savePuzzleFeedSettingsMutation.name,
];

/** Refused puzzle feed settings, inline under the feed bar that opens them. */
export function PuzzleFeedRefusedChangeNotice(): JSX.Element {
  return <RefusedChangeNotice mutations={FEED_SETTINGS_CHANGES} />;
}
