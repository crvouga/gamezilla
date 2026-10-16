import type { GamePresentation } from '@pkgs/turn-game-shared/game-presentation';
import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import { createContext, type JSX, useContext } from 'solid-js';

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
    <Context.Provider
      value={{ rules: props.rules, presentations: props.presentations }}
    >
      {props.children}
    </Context.Provider>
  );
}
export function useTurnGames() {
  const value = useContext(Context);
  if (value === undefined) throw new Error('TurnGamesProvider is required');
  return value.rules;
}
export function useGamePresentation() {
  const value = useContext(Context);
  if (value === undefined) throw new Error('TurnGamesProvider is required');
  return (position: string): GamePresentation<JSX.Element> => {
    const id = value.rules.forPosition(position).id;
    const presentation = value.presentations.find((p) => p.id === id);
    if (presentation === undefined)
      throw new Error(`Missing game presentation: ${id}`);
    return presentation;
  };
}
