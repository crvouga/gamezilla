import type {
  PuzzleAutoAdvance,
  PuzzleFeedHistoryFilter,
} from '@libs/game-puzzle-shared-ts/feed-config';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { For, type JSX } from 'solid-js';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';

type Choice<Key extends string> = {
  readonly key: Key;
  readonly title: () => JSX.Element;
  readonly caption: () => JSX.Element;
};

const HISTORY: readonly Choice<PuzzleFeedHistoryFilter>[] = [
  {
    key: 'neverSeen',
    title: () => <Trans>Unseen</Trans>,
    caption: () => <Trans>Only puzzles you have never played.</Trans>,
  },
  {
    key: 'any',
    title: () => <Trans>Any</Trans>,
    caption: () => <Trans>Every puzzle, played or not.</Trans>,
  },
  {
    key: 'seen',
    title: () => <Trans>Seen</Trans>,
    caption: () => <Trans>Only puzzles you have played before.</Trans>,
  },
  {
    key: 'failed',
    title: () => <Trans>Failed</Trans>,
    caption: () => <Trans>Only puzzles you failed, to try again.</Trans>,
  },
];

const ADVANCE: readonly Choice<PuzzleAutoAdvance>[] = [
  {
    key: 'off',
    title: () => <Trans>Wait for me</Trans>,
    caption: () => <Trans>The next puzzle starts when you ask.</Trans>,
  },
  {
    key: 'after1s',
    title: () => <Trans>Next after 1 s</Trans>,
    caption: () => <Trans>A solve moves on after one second.</Trans>,
  },
  {
    key: 'immediate',
    title: () => <Trans>Next immediately</Trans>,
    caption: () => <Trans>A solve moves on at once.</Trans>,
  },
];

/** One short list: pressing a choice applies it and returns to the settings. */
function ChoiceRows<Key extends string>(props: {
  readonly choices: readonly Choice<Key>[];
  readonly selected: Key;
  readonly testId: (key: Key) => string;
  readonly onChoose: (key: Key) => void;
}): JSX.Element {
  return (
    <MenuSection>
      <For each={props.choices}>
        {(choice) => (
          <MenuRow
            title={choice.title()}
            caption={choice.caption()}
            selected={choice.key === props.selected}
            hideChevron
            onClick={() => props.onChoose(choice.key)}
            dataSet={{ testid: props.testId(choice.key) }}
          />
        )}
      </For>
    </MenuSection>
  );
}

/**
 * The `feed-history` place: which puzzles the feed draws from, by whether
 * the player has played them. Choosing one sets the draft and returns.
 */
export function PuzzleFeedHistoryView(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  return (
    <EmbeddedScreen
      screenId="chess-puzzle-feed-history"
      title={<Trans>Play history</Trans>}
    >
      <ChoiceRows
        choices={HISTORY}
        selected={props.feed.draft.historyFilter}
        testId={Handles.chessPuzzleFeedHistorySegment}
        onChoose={(historyFilter) => {
          props.feed.onChange({ historyFilter });
          props.onBack();
        }}
      />
    </EmbeddedScreen>
  );
}

/**
 * The `feed-advance` place: what happens after a solve. Choosing one sets
 * the draft and returns.
 */
export function PuzzleFeedAdvanceView(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  return (
    <EmbeddedScreen
      screenId="chess-puzzle-feed-advance"
      title={<Trans>After solving</Trans>}
    >
      <ChoiceRows
        choices={ADVANCE}
        selected={props.feed.draft.autoAdvance}
        testId={Handles.chessPuzzleFeedAutoAdvanceSegment}
        onChoose={(autoAdvance) => {
          props.feed.onChange({ autoAdvance });
          props.onBack();
        }}
      />
    </EmbeddedScreen>
  );
}
