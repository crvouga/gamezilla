import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import type { JSX } from 'solid-js';
import type { MultiplayerPlace, MultiplayerStage } from './multiplayer-places';

/** What every place of finding an opponent is given by its shell. */
export type MultiplayerPlaceFrame = {
  readonly stage: MultiplayerStage;
  readonly place: MultiplayerPlace;
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

/** A stage or a result: the game's own screen, around its board. */
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
      dataSet={placeMark(props)}
    >
      {props.children}
    </GameScreen>
  );
}
