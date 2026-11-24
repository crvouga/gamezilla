import type { GamePresentation } from '@pkgs/turn-game-shared-ts/game-presentation';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from '@solidjs/web';
import { createContext, useContext } from 'solid-js';

const Context = createContext<{
  rules: TurnGames;
  presentations: readonly GamePresentation<JSX.Element>[];
}>();
export function TurnGamesProvider(props: {
  rules: TurnGames;
  presentations: readonly GamePresentation<JSX.Element>[];
  children: JSX.Element;
}): JSX.Element {
  return (
    <Context value={{ rules: props.rules, presentations: props.presentations }}>
      {props.children}
    </Context>
  );
}
export function useTurnGames() {
  const value = useContext(Context);
  return value.rules;
}
export function useGamePresentation() {
  const value = useContext(Context);
  return (position: string): GamePresentation<JSX.Element> => {
    const id = value.rules.forPosition(position).id;
    const presentation = value.presentations.find((p) => p.id === id);
    if (presentation === undefined)
      throw new Error(`Missing game presentation: ${id}`);
    return presentation;
  };
}

/** How a game is won, in one sentence, by the game's id; none if it has no such line. */
export function useGameGoal() {
  const value = useContext(Context);
  return (gameId: string): string | undefined =>
    value.presentations.find((p) => p.id === gameId)?.goal?.();
}
