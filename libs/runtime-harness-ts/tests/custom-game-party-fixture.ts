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
export function delayedPartyHost(
  mode: 'ordinary' | 'reviewed' | 'rebased' = 'ordinary'
) {
  const moves: string[] = [];
  const players: string[] = [];
  let view: Omit<PublicCustomGame, 'canMove'> = {
    position: rules.initial(),
    status: 'active',
    turn: 'white',
    outcome: '',
    ply: 0,
  };
  let hostView = view;
  let reviewing: number | null = null;
  let reviewed = false;
  let returnsLive = 0;
  let rebased = false;
  let ready = true;
  const read = (actor: 'white' | 'black'): string => {
    const shown = actor === 'white' ? hostView : view;
    if (mode === 'reviewed' && !reviewed && shown.ply === 16) {
      reviewed = true;
      reviewing = 15;
    }
    const snapshot = JSON.stringify({
      ...shown,
      position:
        reviewing === null ? shown.position : rules.replay(moves, reviewing),
      canMove:
        ready &&
        shown.status === 'active' &&
        reviewing === null &&
        shown.turn === actor,
    });
    if (mode === 'rebased' && !rebased && shown.ply === 16) {
      const prefix = moves.slice(0, 15);
      const position = rules.replay(prefix, prefix.length);
      const action = game.shared.automation.turns.choose(
        position,
        () => 0.75,
        null
      );
      const next = rules.play(position, action!, prefix.join(','), prefix);
      if (next === null)
        throw new Error('The authoritative bot move is illegal');
      moves[15] = action!;
      view = { ...view, position: next.position };
      hostView = view;
      rebased = true;
    }
    return snapshot;
  };
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
      const bot = game.shared.automation.turns.choose(
        view.position,
        () => (mode === 'reviewed' && view.ply === 15 ? 0.75 : 0.25),
        null
      );
      if (bot === null) throw new Error('Bot has no action');
      accept(bot);
    }
    if (actor === 'white') hostView = view;
  };
  const waitFor = (actor: 'white' | 'black', id: string): void => {
    if (view.turn !== actor) throw new Error(`It is ${view.turn}'s turn`);
    if (!ready) throw new Error('The board is not ready for input');
    if (reviewing !== null) throw new Error('The reviewed board is read-only');
    if (!id.startsWith('custom-game-board-action-')) return;
    const action = id.slice('custom-game-board-action-'.length);
    if (!rules.legal(view.position).includes(action))
      throw new Error(`${action} is disabled on the current board`);
  };
  const driver = (actor: 'white' | 'black'): Driver => ({
    kind: 'delayed-party',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: (id) =>
      partyNode(id, {
        read: () => read(actor),
        tap: () => {
          if (id !== 'custom-game-review-live') return unused();
          reviewing = null;
          returnsLive++;
        },
        wait: () => waitFor(actor, id),
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
  return {
    host,
    players,
    moves,
    returnsLive: () => returnsLive,
    rebased: () => rebased,
    setReady: (value: boolean) => {
      ready = value;
    },
    externalMove: (action: string) => {
      accept(action);
      hostView = view;
    },
  };
}

function unused(): never {
  throw new Error('Unexpected party gesture');
}

function partyNode(
  id: string,
  actions: {
    read(): string;
    tap(): void;
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
    tap: async () => actions.tap(),
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
