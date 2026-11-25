import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import type {
  StageOverlay,
  StageOverlayEvent,
  StageOverlayPhase,
} from '@pkgs/turn-game-client-ts/stage-overlay';
import {
  GameResultCard,
  type GameResultCardProps,
  GameVersusOverlay,
  type GameVersusSide,
} from '@pkgs/ui-root-client-ts/game-stage-overlay';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Match, Show, Switch } from 'solid-js';
import type { MultiplayerStage } from './multiplayer-places';

/**
 * Where the matched game stands, as its board's overlay cares. A search
 * (or nothing under way) is the game's setup, so the match found from it
 * is watched begin; a game still being read is not.
 */
export function multiplayerOverlayPhase(
  stage: MultiplayerStage
): StageOverlayPhase {
  if (stage === 'playing') return 'play';
  if (stage === 'finished') return 'over';
  return stage === 'loading' || stage === 'denied' ? 'unknown' : 'setup';
}

/** Who plays whom, as the versus card shows them. */
export type MultiplayerVersusShown = {
  /** The other players, in the band above. */
  readonly others: readonly GameVersusSide[];
  /** The person's own side (or the rest of a watched game), below. */
  readonly own: readonly GameVersusSide[];
  /** The clock the game is played at, in plain words; none when untimed. */
  readonly clock?: string | undefined;
  /** The same clock as its figures (`5+0`), beside the game's name. */
  readonly timeControl?: string | undefined;
  /**
   * What an untimed game is played to (`First to 11`,
   * `GameFrame.target`), beside the game's name where a clock would be.
   */
  readonly target?: string | undefined;
};

/** How the matched game ended, as the result card says it. */
export type MultiplayerResultShown = {
  readonly tone: GameResultCardProps['tone'];
  /** The game was aborted: there is no result. */
  readonly aborted?: boolean | undefined;
  /** The game was drawn, whoever reads it (a watcher's tone is neutral). */
  readonly drawn?: boolean | undefined;
  /** Who won, in a sentence. */
  readonly title: JSX.Element;
  /** Why, and an offered rematch. */
  readonly caption?: JSX.Element | undefined;
  /** What the game did to the person's rating: its own row, under the why. */
  readonly rating?: JSX.Element | undefined;
};

type OverlayProps = {
  /** The game's name. */
  readonly title: string;
  readonly overlay: StageOverlay;
  readonly onOverlay: (event: StageOverlayEvent) => void;
  readonly versus: MultiplayerVersusShown | undefined;
  readonly result: MultiplayerResultShown | undefined;
  /** Under the result: where else it leads. */
  readonly children?: JSX.Element | undefined;
};

/**
 * Over the card's headline, one word: how the game went for the person,
 * as a custom game's result says it (Victory, Defeat, Draw, Aborted).
 */
function headline(result: MultiplayerResultShown): string {
  if (result.aborted === true) return t`Aborted`;
  if (result.tone === 'won') return t`Victory`;
  if (result.tone === 'lost') return t`Defeat`;
  if (result.tone === 'drawn' || result.drawn === true) return t`Draw`;
  // Not "Game over": the dialog's own title already says that.
  return t`Final result`;
}

function VersusCard(
  props: OverlayProps & {
    readonly versus: MultiplayerVersusShown;
    readonly count: number;
  }
): JSX.Element {
  return (
    <GameVersusOverlay
      others={props.versus.others}
      own={props.versus.own}
      mark={<Trans>VS</Trans>}
      count={props.count}
      countLabel={<Trans>Starts in</Trans>}
      skipLabel={<Trans>Start now</Trans>}
      aria-label={t`Opponent found. The game is starting.`}
      onSkip={() => props.onOverlay({ type: 'skip' })}
      dataSet={{ testid: 'multiplayer-versus', count: String(props.count) }}
    />
  );
}

/**
 * What lies over the matched game's board, as the stage's overlay machine
 * says (`StageOverlay`): the versus card and its count when an opponent is
 * found on this device, else nothing. How the game ended is told beside
 * the board (`MultiplayerResultCard`), so the final position is never
 * covered.
 */
export function MultiplayerOverlayView(props: OverlayProps): JSX.Element {
  const versus = () =>
    props.overlay.kind === 'versus' && props.versus !== undefined
      ? { count: props.overlay.count, shown: props.versus }
      : null;
  return (
    <Switch>
      <Match when={versus()}>
        {(card) => (
          <VersusCard {...props} versus={card().shown} count={card().count} />
        )}
      </Match>
    </Switch>
  );
}

/**
 * How the matched game ended, beside the final board (under it on a
 * phone, heading the rail beside a wide one), never over it: the word, the
 * sentence, why and the rating change, then where else it leads. It is the
 * screen's announcement of how the game ended.
 */
export function MultiplayerResultCard(props: {
  readonly result: MultiplayerResultShown | undefined;
  /** Under the result: where else it leads. */
  readonly children?: JSX.Element | undefined;
}): JSX.Element {
  return (
    <Show when={props.result}>
      {(result) => (
        <GameResultCard
          live
          tone={result().tone}
          // Every outcome opens with its word, a draw's too, as a custom
          // game's result does.
          // The outcome's word, and what it did to the rating beside it on
          // the same line, so the card stays short over the board.
          eyebrow={
            <StackHorizontal align="center" gap="sm">
              {headline(result())}
              {result().rating}
            </StackHorizontal>
          }
          title={result().title}
          caption={result().caption}
          dataSet={{ testid: 'multiplayer-announcement' }}
        >
          {props.children}
        </GameResultCard>
      )}
    </Show>
  );
}
