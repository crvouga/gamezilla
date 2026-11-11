import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import type {
  StageOverlay,
  StageOverlayEvent,
  StageOverlayPhase,
} from '@pkgs/turn-game-client-ts/stage-overlay';
import {
  GameResultOverlay,
  type GameResultOverlayProps,
  GameVersusOverlay,
  type GameVersusSide,
} from '@pkgs/ui-root-client-ts/game-stage-overlay';
import { type JSX, Match, Switch } from 'solid-js';
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
};

/** How the matched game ended, as the result card says it. */
export type MultiplayerResultShown = {
  readonly tone: GameResultOverlayProps['tone'];
  /** The game was aborted: there is no result. */
  readonly aborted?: boolean | undefined;
  /** Who won, in a sentence. */
  readonly title: JSX.Element;
  /** Why, an offered rematch and the rating change. */
  readonly caption?: JSX.Element | undefined;
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

/** Over the card's headline, one word: how the game went for the person. */
function headline(result: MultiplayerResultShown): string {
  if (result.aborted === true) return t`No result`;
  if (result.tone === 'won') return t`Victory`;
  if (result.tone === 'lost') return t`Defeat`;
  if (result.tone === 'drawn') return t`Draw`;
  return t`Game over`;
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
      skipLabel={<Trans>Skip</Trans>}
      aria-label={t`Opponent found. The game is starting.`}
      onSkip={() => props.onOverlay({ type: 'skip' })}
      dataSet={{ testid: 'multiplayer-versus', count: String(props.count) }}
    />
  );
}

/**
 * What lies over the matched game's board, as the stage's overlay machine
 * says (`StageOverlay`): the versus card and its count when an opponent is
 * found on this device, the result card once the game is over, else
 * nothing. The result card is the screen's announcement of how the game
 * ended.
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
      <Match when={props.overlay.kind === 'outcome' ? props.result : undefined}>
        {(result) => (
          <GameResultOverlay
            live
            tone={result().tone}
            eyebrow={headline(result())}
            title={result().title}
            caption={result().caption}
            dismissLabel={t`Show the board`}
            onDismiss={() => props.onOverlay({ type: 'dismiss' })}
            dataSet={{ testid: 'multiplayer-announcement' }}
          >
            {props.children}
          </GameResultOverlay>
        )}
      </Match>
    </Switch>
  );
}
