import { GameWatcherCount } from '@pkgs/ui-root-client-ts/game-watching';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Show } from 'solid-js';
import { FrameNextActionsView } from './game-frame-actions-view';
import {
  FrameResultHeadlineView,
  FrameResultView,
} from './game-frame-result-view';
import type { GameFrameScreenViewProps } from './game-frame-screen-view';
import {
  FrameFactsView,
  FramePlayNoticesView,
  FrameStatusView,
  frameWatchersLabel,
} from './game-frame-status-view';

/** Play notices or final standings; the outcome headline leads the final board. */
export function FrameStatusRow(props: GameFrameScreenViewProps): JSX.Element {
  return (
    <>
      {/* While set up without its setup in view, the line still says why. */}
      <Show when={props.phase === 'configuring' && props.setup === null}>
        <FrameStatusView status={props.status} />
      </Show>
      <Show when={props.phase === 'active'}>
        <FramePlayNoticesView play={props.play} people={props.people} />
      </Show>
      <Show when={props.phase === 'completed' ? props.result : null}>
        {(result) => (
          <FrameResultView result={result()} people={props.people} />
        )}
      </Show>
    </>
  );
}

/** One result and one set of next actions, immediately before the final position. */
export function FrameOutcomeView(props: GameFrameScreenViewProps): JSX.Element {
  return (
    <Show when={props.phase === 'completed' ? props.result : null}>
      {(result) => (
        <StackVertical gap="sm" testId="custom-game-outcome">
          <FrameResultHeadlineView result={result()} />
          <FrameNextActionsView
            next={props.next}
            onChoose={props.onChoose}
            onBack={props.onBack}
            onSeek={props.onSeek}
            width="content"
          />
        </StackVertical>
      )}
    </Show>
  );
}

/** The title-row facts and exact watcher count. */
export function FrameFacts(props: GameFrameScreenViewProps): JSX.Element {
  return (
    <>
      <FrameFactsView status={props.status} />
      <Show when={props.watchers > 0}>
        <GameWatcherCount
          value={props.watchers}
          label={frameWatchersLabel(props.watchers)}
          dataSet={{ testid: 'custom-game-watchers' }}
        />
      </Show>
    </>
  );
}
