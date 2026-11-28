import type {
  GameSessionChoice,
  GameSessionInput,
} from '@libs/game-session-shared-ts/game-session-choice';
import type {
  GameSession,
  PlayMode,
} from '@libs/game-session-shared-ts/game-session-state';
import { gameSessionTerminal } from '@libs/game-session-shared-ts/game-session-state';
import type { Accessor } from 'solid-js';
import type { useGameSessionPrivateSetup } from './use-game-session-private-setup';

export function useGameSessionChoices(options: {
  gameId: Accessor<string>;
  current: Accessor<GameSession | null>;
  send: (choice: GameSessionChoice) => Promise<string | null>;
  privateSetup: Pick<
    ReturnType<typeof useGameSessionPrivateSetup>,
    'has' | 'draft' | 'complete'
  >;
}) {
  const send = (input: GameSessionInput) => {
    const current = options.current();
    return options.send({
      ...input,
      ...(input.operation === 'create' ? { game: options.gameId() } : {}),
      gameId: current?.id ?? null,
      revision: current?.revision ?? 0,
    });
  };
  // A start control can still receive a tap while a room update is painting.
  let creating = false;
  const create = async (mode: PlayMode) => {
    const current = options.current();
    if (creating || (current !== null && !gameSessionTerminal(current)))
      return null;
    creating = true;
    try {
      return await send({ operation: 'create', mode });
    } finally {
      creating = false;
    }
  };
  const choose = async (input: GameSessionInput): Promise<void> => {
    if (input.operation === 'create') await create(input.mode);
    else await send(input);
  };
  const ready = async (): Promise<void> => {
    const setup = options.privateSetup;
    if (!setup.has()) return choose({ operation: 'ready' });
    if (setup.complete())
      await choose({ operation: 'ready', setup: setup.draft() });
  };
  return {
    choose,
    ready,
  };
}
