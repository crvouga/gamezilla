import { t } from '@lingui/core/macro';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameResultHeadline } from '@pkgs/ui-root-client-ts/game-result';
import { GameWatcherCount } from '@pkgs/ui-root-client-ts/game-watching';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Show } from 'solid-js';
import { FrameNextActions } from './game-frame-actions-view';
import { recordReviewing } from './game-frame-record-view';
import { FrameResultView } from './game-frame-result-view';
import type { GameFrameScreenViewProps } from './game-frame-screen-view';
import {
  FrameFactsView,
  FramePlayNoticesView,
  FrameStatusView,
  frameWatchersLabel,
} from './game-frame-status-view';

/** A required choice stays reachable before the board, without duplicating it. */
export function FrameRequiredActions(
  props: GameFrameScreenViewProps
): JSX.Element {
  return (
    <Show when={props.phase === 'active' && !recordReviewing(props.record)}>
      <GameActionBar items={props.play.leadingBoardActions} />
    </Show>
  );
}

/** The outcome and next choices precede the final board or the wide record. */
export function FrameCompletionLead(
  props: GameFrameScreenViewProps
): JSX.Element {
  return (
    <Show when={props.phase === 'completed' || props.phase === 'cancelled'}>
      <StackVertical gap="sm" testId="custom-game-completion-lead">
        <GameResultHeadline
          title={
            props.result?.headline ??
            props.status?.description ??
            t`Game finished`
          }
          caption={props.result?.note ?? undefined}
          dataSet={{ testid: 'custom-game-result-headline' }}
        />
        <FrameNextActions
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

/**
 * Under the board on a phone, heading the rail beside a wide one: what a
 * player is told during play, and the result once the game is over (once it is played the turn line sits
 * between the board and the person's own seat). Play actions follow it, so
 * they stay in view with the board on every screen.
 */
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
          <FrameResultView
            result={result()}
            people={props.people}
            headline="separate"
          />
        )}
      </Show>
    </>
  );
}

/** On the title's line: unrated, the clock, and how many watch. */
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
