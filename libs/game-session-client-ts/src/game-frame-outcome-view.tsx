import { t } from '@lingui/core/macro';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameResultHeadline } from '@pkgs/ui-root-client-ts/game-result';
import { GameWatcherCount } from '@pkgs/ui-root-client-ts/game-watching';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Show } from 'solid-js';
import { FrameNextActionsView } from './game-frame-actions-view';
import { recordReviewing } from './game-frame-record-view';
import { FrameResultView } from './game-frame-result-view';
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
    <Show when={props.phase === 'completed' || props.phase === 'cancelled'}>
      <StackVertical gap="sm" testId="custom-game-outcome">
        <GameResultHeadline
          title={
            props.result?.headline ??
            props.status?.description ??
            t`Game finished`
          }
          caption={props.result?.note ?? undefined}
          dataSet={{ testid: 'custom-game-result-headline' }}
        />
        <FrameStatusView status={props.status} />
        <FrameNextActionsView
          next={props.next}
          onChoose={props.onChoose}
          onBack={props.onBack}
          onSeek={props.onSeek}
          width="content"
        />
      </StackVertical>
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

/** Required choices precede the board while its current position is live. */
export function FrameRequiredActions(
  props: GameFrameScreenViewProps
): JSX.Element {
  return (
    <Show when={props.phase === 'active' && !recordReviewing(props.record)}>
      <GameActionBar items={props.play.leadingBoardActions} />
    </Show>
  );
}
