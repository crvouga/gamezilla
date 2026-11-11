import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Match, Switch } from 'solid-js';
import {
  PuzzleFeedAdvanceView,
  PuzzleFeedHistoryView,
} from './puzzle-feed-choice-views';
import { PuzzleFeedHubView } from './puzzle-feed-hub-view';
import { PuzzleFeedTargetView } from './puzzle-feed-target-view';
import { PuzzleFeedThemesView } from './puzzle-feed-themes-view';
import { PuzzlePlayLineView } from './puzzle-play-line-view';
import { PuzzlePlayResultView } from './puzzle-play-result-view';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';
import { PuzzlePlaySolveView } from './puzzle-play-solve-view';
import { PuzzlePlayStatusView } from './puzzle-play-status-view';

/**
 * The puzzle feed, presentational: one small screen at a time, chosen by
 * the place machine (`puzzle-play-places`). `status` says why there is no
 * puzzle; `play` is the board with its one status line; `line` steps
 * through the moves; `result` says how the puzzle went and what next;
 * `feed` and its `feed-…` screens set what the feed serves. Around
 * whichever shows: a refused change, the test probes and the live regions.
 * The stage and the place are args, so every place of every stage is a
 * story; `PuzzlePlayScreen` wires the room.
 */
export function PuzzlePlayScreenView(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  return (
    <StackVertical
      grow
      self="stretch"
      testId="chess-puzzle-play-screen"
      dataSet={{ stage: props.stage, place: props.place.screen }}
    >
      {props.probe}
      {props.notices}
      <Switch>
        <Match when={props.place.screen === 'status'}>
          <PuzzlePlayStatusView {...props} />
        </Match>
        <Match when={props.place.screen === 'play'}>
          <PuzzlePlaySolveView {...props} />
        </Match>
        <Match when={props.place.screen === 'line'}>
          <PuzzlePlayLineView {...props} />
        </Match>
        <Match when={props.place.screen === 'result'}>
          <PuzzlePlayResultView {...props} />
        </Match>
        <Match when={props.place.screen === 'feed'}>
          <PuzzleFeedHubView {...props} />
        </Match>
        <Match when={props.place.screen === 'feed-target'}>
          <PuzzleFeedTargetView {...props} />
        </Match>
        <Match when={props.place.screen === 'feed-history'}>
          <PuzzleFeedHistoryView {...props} />
        </Match>
        <Match when={props.place.screen === 'feed-themes'}>
          <PuzzleFeedThemesView {...props} />
        </Match>
        <Match when={props.place.screen === 'feed-advance'}>
          <PuzzleFeedAdvanceView {...props} />
        </Match>
      </Switch>
      {props.overlay}
    </StackVertical>
  );
}
