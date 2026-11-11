import { Trans } from '@lingui/solid/macro';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { GameFact, GameFacts } from '@pkgs/ui-root-client-ts/game-facts';
import { GameLobbyScreen } from '@pkgs/ui-root-client-ts/game-lobby';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { type JSX, Show } from 'solid-js';
import type { MultiplayerPlace, MultiplayerStage } from './multiplayer-places';

/** What every place of finding an opponent is given by its shell. */
export type MultiplayerPlaceFrame = {
  readonly stage: MultiplayerStage;
  readonly place: MultiplayerPlace;
  /** The clock the game is played at, as its figures (`5+0`); none when untimed. */
  readonly clock?: string | undefined;
  /** The connection and refusal notices, the same on every place. */
  readonly notices: JSX.Element;
};

/**
 * How a place names itself to whatever drives the screen: the template's
 * one mark, with the stage and the place shown now.
 */
function placeMark(
  frame: Pick<MultiplayerPlaceFrame, 'stage' | 'place'>
): Record<string, string> {
  return {
    testid: 'multiplayer-screen',
    stage: frame.stage,
    place: frame.place.screen,
  };
}

/** A hub or a choice: one titled column of rows under the notices. */
export function MultiplayerMenuPlace(
  props: MultiplayerPlaceFrame & {
    readonly title: JSX.Element;
    readonly subtitle?: JSX.Element | undefined;
    readonly children: JSX.Element;
  }
): JSX.Element {
  return (
    <EmbeddedScreen
      screenId="multiplayer"
      title={props.title}
      subtitle={props.subtitle}
      dataSet={placeMark(props)}
    >
      {props.notices}
      {props.children}
    </EmbeddedScreen>
  );
}

/**
 * Before a game: what is about to be played over the one command that
 * moves on (find an opponent, stop looking), held at the foot of the
 * screen.
 */
export function MultiplayerLobbyPlace(
  props: MultiplayerPlaceFrame & {
    readonly dock: JSX.Element;
    readonly children: JSX.Element;
  }
): JSX.Element {
  return (
    <GameLobbyScreen
      screenId="multiplayer"
      dock={props.dock}
      dataSet={placeMark(props)}
    >
      {props.notices}
      {props.children}
    </GameLobbyScreen>
  );
}

/**
 * A stage or a result: the game's own screen, around its board, under the
 * game's name and what is played for (`Rated · 5+0`).
 */
export function MultiplayerStagePlace(
  props: Omit<MultiplayerPlaceFrame, 'notices'> & {
    readonly title: JSX.Element;
    readonly children: JSX.Element;
  }
): JSX.Element {
  return (
    <GameScreen
      screenId="multiplayer"
      title={props.title}
      facts={
        <GameFacts>
          <GameFact label={<Trans>Rated</Trans>} />
          <Show when={props.clock}>
            {(clock) => (
              <GameFact label={clock()} testId="multiplayer-time-control" />
            )}
          </Show>
        </GameFacts>
      }
      dataSet={placeMark(props)}
    >
      {props.children}
    </GameScreen>
  );
}
