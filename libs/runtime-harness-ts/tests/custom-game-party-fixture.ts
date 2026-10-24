import { QUORIDOR_HILL_PLAYABLE } from '@libs/quoridor-harness-ts/quoridor-playable';
import type { PublicCustomGame } from '@libs/runtime-harness-ts/custom-game-party-journey';
import type { JourneyHost } from '@libs/runtime-harness-ts/journey-types';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

const game = QUORIDOR_HILL_PLAYABLE;
const rules = game.shared.turnGame.rules;

/** The peer sees both bot replies before its previous move reaches the host. */
export function delayedPartyHost() {
  const moves: string[] = [];
  const players: string[] = [];
  let view: PublicCustomGame = {
    position: rules.initial(),
    status: 'active',
    turn: 'white',
    outcome: '',
    ply: 0,
  };
  let hostView = view;
  const accept = (action: string): void => {
    const next = rules.play(view.position, action, moves.join(','), moves);
    if (next === null) throw new Error(`Illegal party move ${action}`);
    moves.push(action);
    view = {
      position: next.position,
      status: next.winner === null ? 'active' : 'completed',
      turn: next.turn,
      outcome: next.winner ?? '',
      ply: moves.length,
    };
  };
  const play = (actor: 'white' | 'black', action: string): void => {
    if (view.turn !== actor) throw new Error(`It is ${view.turn}'s turn`);
    players.push(actor);
    accept(action);
    while (view.status === 'active' && ['red', 'blue'].includes(view.turn)) {
      const bot = game.shared.automation.choose(view.position, () => 0.25);
      if (bot === null) throw new Error('Bot has no action');
      accept(bot);
    }
    if (actor === 'white') hostView = view;
  };
  const driver = (actor: 'white' | 'black'): Driver => ({
    kind: 'delayed-party',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: (id) =>
      partyNode(id, {
        read: () => JSON.stringify(actor === 'white' ? hostView : view),
        wait: () => {
          if (view.turn !== actor) throw new Error(`It is ${view.turn}'s turn`);
        },
        key: () => {
          if (id.startsWith('custom-game-board-action-'))
            play(actor, id.slice('custom-game-board-action-'.length));
        },
        visible: () => {
          if (!id.startsWith('custom-game-review-move-')) return;
          const ply = Number(id.slice('custom-game-review-move-'.length));
          if (ply > view.ply) throw new Error(`Move ${ply} has not arrived`);
          if (actor === 'white' && ply > hostView.ply) hostView = view;
        },
      }),
  });
  const host: Pick<JourneyHost, 'act' | 'actAsGuest'> = {
    act: async (_name, gestures) => gestures(driver('white')),
    actAsGuest: async (_name, gestures) => gestures(driver('black')),
  };
  return { host, players, moves };
}

function unused(): never {
  throw new Error('Unexpected party gesture');
}

function partyNode(
  id: string,
  actions: {
    read(): string;
    wait(): void;
    key(): void;
    visible(): void;
  }
): DriverNode {
  return {
    get: unused,
    attribute: async () => {
      if (id !== 'custom-game-public') return unused();
      return actions.read();
    },
    tap: unused,
    tapAt: unused,
    drag: unused,
    layout: unused,
    input: unused,
    selectFile: unused,
    clear: unused,
    key: async () => actions.key(),
    scroll: unused,
    wait: async () => actions.wait(),
    expect: {
      visible: async () => actions.visible(),
      hidden: unused,
      text: unused,
    },
    isVisible: unused,
    text: unused,
  };
}
