import { createContext, type JSX, untrack, useContext } from 'solid-js';

/** A registered game's id and the name the game menu shows for it. */
export type GameName = {
  readonly id: string;
  readonly title: string;
};

const NO_NAMES: ReadonlyMap<string, string> = new Map<string, string>();
const GameNamesContext = createContext<ReadonlyMap<string, string>>(NO_NAMES);

/**
 * The names of the games Synthetic Users play, supplied by the composition
 * root (which owns the game registry) so the Bot Observatory never names a
 * game itself.
 */
export function GameNamesProvider(props: {
  readonly games: readonly GameName[];
  readonly children: JSX.Element;
}): JSX.Element {
  // Registry is composition-root configuration: read once, not tracked.
  const names = untrack(
    () => new Map(props.games.map((game) => [game.id, game.title]))
  );
  return (
    <GameNamesContext.Provider value={names}>
      {props.children}
    </GameNamesContext.Provider>
  );
}

/** A game's name as people see it; an id no game claims shows as itself. */
export function useGameName(): (id: string) => string {
  const names = useContext(GameNamesContext);
  return (id) => names.get(id) ?? id;
}
