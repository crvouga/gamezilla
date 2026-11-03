import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { MainMenuItem } from '@pkgs/ui-root-client-ts/main-menu-item-row';
import { MainMenuScreen } from '@pkgs/ui-root-client-ts/main-menu-screen';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createMemo, type JSX, Show } from 'solid-js';

/** One choice in a game's menu: the screen it opens and how it reads. */
export type GameMenuChoiceView = {
  /** Its key in the space; also names its control (`game-choice-<screen>`). */
  readonly screen: string;
  readonly title: JSX.Element;
  readonly caption: JSX.Element;
};

export type GameMenuScreenViewProps = {
  /** The game's name. */
  readonly title: string;
  /** One line under the name. */
  readonly subtitle: JSX.Element;
  /** How to play, under the choices. */
  readonly instructions?: JSX.Element | undefined;
  /** The game's own choices, then the shared ones, in the one order every game shares. */
  readonly choices: readonly GameMenuChoiceView[];
  readonly onChoose: (screen: string) => void;
};

/**
 * A game's menu in a space, presentational: its name, its own and the
 * shared choices (puzzles, custom games, finding an opponent, history,
 * settings) and how to play. `GameMenu` decides which choices the game
 * offers and opens the screen each one names.
 */
export function GameMenuScreenView(
  props: GameMenuScreenViewProps
): JSX.Element {
  const items = createMemo((): MainMenuItem[] =>
    props.choices.map((choice) => ({
      key: choice.screen,
      title: choice.title,
      caption: choice.caption,
      dataSet: { testid: Handles.gameChoice(choice.screen) },
      onClick: () => props.onChoose(choice.screen),
    }))
  );
  return (
    <MainMenuScreen
      screenId="game-choices"
      dataSet={{ testid: Handles.gameChoices }}
      title={props.title}
      subtitle={props.subtitle}
      items={items()}
      helper={
        <Show when={props.instructions}>
          <P variant="caption" tone="secondary">
            {props.instructions}
          </P>
        </Show>
      }
    />
  );
}
