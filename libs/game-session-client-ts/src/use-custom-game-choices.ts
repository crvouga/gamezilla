import type {
  CustomGameChoice,
  CustomGameInput,
} from '@libs/game-session-shared-ts/custom-game-choice';
import type { CustomGame } from '@libs/game-session-shared-ts/custom-game-state';
import { customGameTerminal } from '@libs/game-session-shared-ts/custom-game-state';
import { type Accessor, onCleanup } from 'solid-js';
import type { useCustomGamePrivateSetup } from './use-custom-game-private-setup';

export function useCustomGameChoices(options: {
  gameId: Accessor<string>;
  current: Accessor<CustomGame | null>;
  spaceId: Accessor<string>;
  send: (choice: CustomGameChoice) => Promise<string | null>;
  privateSetup: Pick<
    ReturnType<typeof useCustomGamePrivateSetup>,
    'has' | 'draft' | 'complete' | 'random'
  >;
}) {
  let closed = false;
  onCleanup(() => {
    closed = true;
  });
  const send = (input: CustomGameInput) => {
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
  const create = async () => {
    const current = options.current();
    if (creating || (current !== null && !customGameTerminal(current)))
      return null;
    creating = true;
    try {
      return await send({ operation: 'create' });
    } finally {
      creating = false;
    }
  };
  const choose = async (input: CustomGameInput): Promise<void> => {
    if (input.operation === 'create') await create();
    else await send(input);
  };
  const ready = () =>
    choose(
      options.privateSetup.has()
        ? { operation: 'ready', setup: options.privateSetup.draft() }
        : { operation: 'ready' }
    );
  const playBot = async (): Promise<void> => {
    const requested = options.gameId();
    const spaceId = options.spaceId();
    const id = await create();
    const ownSetup = () => {
      if (
        closed ||
        id === null ||
        options.spaceId() !== spaceId ||
        options.gameId() !== requested
      )
        return null;
      const current = options.current();
      return current?.id === id && current.status === 'configuring'
        ? current
        : null;
    };
    for (const side of ownSetup()?.sides.slice(1) ?? []) {
      if (ownSetup() === null) return;
      await choose({ operation: 'bot', side });
    }
    if (ownSetup() === null) return;
    if (options.privateSetup.has() && !options.privateSetup.complete())
      options.privateSetup.random();
    await ready();
    if (ownSetup() !== null) await choose({ operation: 'start' });
  };
  return { choose, ready, playBot };
}
