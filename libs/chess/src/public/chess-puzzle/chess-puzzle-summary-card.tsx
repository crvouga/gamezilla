import { Trans } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock/solid';
import {
  type Accessor,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
} from 'solid-js';

import { ChessPuzzleEloDelta } from './chess-puzzle-elo-delta';
import type { PuzzleCompletion } from './use-chess-puzzle-completion';

function StreakBadge(props: { streak: number }): JSX.Element {
  const timers = useTimers();
  const [shown, setShown] = createSignal(false);

  createEffect(() => {
    void props.streak;
    setShown(false);
    const id = timers.setTimeout(() => setShown(true), 0);
    onCleanup(() => timers.clearTimeout(id));
  });

  return (
    <div
      class="box [transition-property:transform,_opacity] [transition-duration:var(--ui-duration-slow)] [transition-timing-function:var(--ui-easing-standard)]"
      style={{
        transform: `scale(${shown() ? 1 : 0.85})`,
        opacity: shown() ? 1 : 0.85,
      }}
    >
      <div class="box px-3 py-1 rounded-[999px] bg-success-surface">
        <p class="text textBodyBold text-success">
          {<Trans>{props.streak} puzzle streak</Trans>}
        </p>
      </div>
    </div>
  );
}

function SummaryMeta(props: { completion: PuzzleCompletion }): JSX.Element {
  const streak = props.completion.streak;
  const puzzleRating = props.completion.puzzleRating;
  return (
    <div class="box gap-2 items-center">
      {streak > 1 ? <StreakBadge streak={streak} /> : null}
      <p class="text textCaption text-text-secondary">
        {<Trans>Puzzle rating {puzzleRating}</Trans>}
      </p>
    </div>
  );
}

function outcomeLabel(outcome: PuzzleCompletion['outcome']): JSX.Element {
  if (outcome === 'solved') return <Trans>Puzzle solved!</Trans>;
  return <Trans>Puzzle abandoned</Trans>;
}

export type ChessPuzzleSummaryCardProps = {
  completion: PuzzleCompletion;
  displayRating: number;
  deltaPulse?: Accessor<number>;
};

export function ChessPuzzleSummaryCard(
  props: ChessPuzzleSummaryCardProps
): JSX.Element {
  const isSolved = props.completion.outcome === 'solved';
  const scale = (): number => props.deltaPulse?.() ?? 1;

  return (
    <div class="box gap-3 p-4 rounded-[8px] self-stretch bg-surface-elevated border border-border">
      <h3
        class="text textHeading text-center"
        style={{ color: isSolved ? 'success' : 'text' }}
      >
        {outcomeLabel(props.completion.outcome)}
      </h3>
      <div
        class="box [transition-property:transform] [transition-duration:var(--ui-duration-fast)] [transition-timing-function:var(--ui-easing-standard)]"
        style={{ transform: `scale(${scale()})` }}
      >
        <ChessPuzzleEloDelta
          ratingBefore={props.completion.ratingBefore}
          ratingAfter={props.completion.ratingAfter}
          delta={props.completion.delta}
          displayRating={props.displayRating}
        />
      </div>
      <SummaryMeta completion={props.completion} />
    </div>
  );
}
