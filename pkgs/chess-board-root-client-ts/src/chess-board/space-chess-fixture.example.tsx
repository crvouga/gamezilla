/** @jsxImportSource @solidjs/web */

import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import { BoardMotionProvider } from '@pkgs/chess-board-root-client-ts/board-motion-context';
import { AudioPlaybackProvider } from '@pkgs/sounds-client-ts/solid';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds-shared-ts/in-memory-audio-playback-port';
import type {
  SpaceGame,
  SpaceGameAction,
  SpaceGamePlay,
  SpaceGameSeat,
  SpacePerson,
  SpaceRole,
} from '@pkgs/ui-root-client-ts/space-types';
import type { JSX } from '@solidjs/web';
import {
  spaceExampleChessSetup,
  spaceExampleChessSide,
  spaceExampleChessSideLook,
} from '../../../ui-root-client-ts/storybook/fixtures/space-example-chess';
import { ChessBoard } from './index';

/**
 * A fixed mid-game moment, so the story never ticks: the viewer is to move,
 * the host (White) after 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6, the guest (Black)
 * one ply earlier, after 3.Bb5.
 */
type ChessMoment = {
  fen: string;
  lastMove: { readonly from: Square; readonly to: Square };
  move: number;
};

const MOMENT: Readonly<Record<SpaceRole, ChessMoment>> = {
  host: {
    fen: 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4',
    lastMove: { from: 'a7', to: 'a6' },
    move: 4,
  },
  guest: {
    fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
    lastMove: { from: 'f1', to: 'b5' },
    move: 3,
  },
};

/** Fixed clocks: White 9:41, Black 9:52. */
const CLOCK = { White: '9:41', Black: '9:52' } as const;

/** The viewer's story person id: the host is bob, a guest is `you`. */
function viewerId(role: SpaceRole): string {
  return role === 'host' ? 'bob' : 'you';
}

/**
 * The two people at the table: bob (the host, White) and `you` (named ana,
 * Black); `you: true` marks whichever one is looking.
 */
export function spaceChessPeople(role: SpaceRole): readonly SpacePerson[] {
  return [
    {
      id: 'bob',
      kind: 'person',
      name: 'bob',
      host: true,
      you: role === 'host',
      initials: 'B',
      tintKey: 'bob',
    },
    {
      id: 'you',
      kind: 'person',
      name: 'ana',
      you: role === 'guest',
      initials: 'A',
      tintKey: 'you',
    },
  ];
}

/** The real board, read-only, without sound or motion. */
function SpaceChessBoard(props: { role: SpaceRole }): JSX.Element {
  const audio = createInMemoryAudioPlaybackPort();
  const motion = {
    animate: null,
    prefersReducedMotion: () => true,
    lowEnd: false,
    hidden: () => false,
    paintedTransform: () => '',
  };
  return (
    <AudioPlaybackProvider value={audio}>
      <BoardMotionProvider value={motion}>
        <ChessBoard
          fen={MOMENT[props.role].fen}
          lastMove={MOMENT[props.role].lastMove}
          orientation={props.role === 'host' ? 'white' : 'black'}
          highlightLastMove
          showCoordinates
          fitSquare
          sound={false}
          animations={false}
          dataSet={{ testid: 'space-chess-board' }}
        />
      </BoardMotionProvider>
    </AudioPlaybackProvider>
  );
}

function action(
  id: string,
  label: string,
  onAction: (id: string) => void,
  tone?: SpaceGameAction['tone']
): SpaceGameAction {
  return { id, label, tone, onPress: () => onAction(id) };
}

/** The side to move: always the viewer's, so the actions are theirs. */
function sideToMove(role: SpaceRole): 'White' | 'Black' {
  return role === 'host' ? 'White' : 'Black';
}

function seat(person: SpacePerson, role: SpaceRole): SpaceGameSeat | undefined {
  const side = spaceExampleChessSide(person);
  if (side === undefined) {
    return undefined;
  }
  return {
    color: side === 'White' ? 'player1' : 'player2',
    turn: side === sideToMove(role),
    data: {
      swatch: spaceExampleChessSideLook(side),
      value: CLOCK[side],
      description: `${side}, ${CLOCK[side]} left`,
    },
  };
}

/**
 * Chess's own actions on a person, by story person id: Offer draw and
 * Resign on the viewer, Request draw and Request takeback on the opponent.
 */
function personActions(
  person: SpacePerson,
  role: SpaceRole,
  onAction: (id: string) => void
): readonly SpaceGameAction[] {
  if (spaceExampleChessSide(person) === undefined) {
    return [];
  }
  return person.id === viewerId(role)
    ? [
        action('offerDraw', 'Offer draw', onAction),
        action('resign', 'Resign', onAction, 'destructive'),
      ]
    : [
        action('requestDraw', 'Request draw', onAction),
        action('requestTakeback', 'Request takeback', onAction),
      ];
}

/** Chess in play at one fixed moment, as the `role` sees it. */
export function spaceChessPlay(
  role: SpaceRole,
  onAction: (id: string) => void
): SpaceGamePlay {
  return {
    status: 'Your move',
    detail: `Chess · move ${MOMENT[role].move}`,
    board: <SpaceChessBoard role={role} />,
    actions: [
      action('resign', 'Resign', onAction, 'destructive'),
      action('offerDraw', 'Offer draw', onAction),
    ],
    seat: (person) => seat(person, role),
    personActions: (person) => personActions(person, role, onAction),
  };
}

/** Chess as a space's game, set up and in play, as the `role` sees it. */
export function spaceChessGame(
  role: SpaceRole,
  onAction: (id: string) => void
): SpaceGame & { play: SpaceGamePlay } {
  return { ...spaceExampleChessSetup(), play: spaceChessPlay(role, onAction) };
}
