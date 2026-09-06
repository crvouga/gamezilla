/**
 * Black-box ChessBoard suite (outside src/): public package entrypoints only.
 * Act with pointer streams; assert only onMove / silence.
 */

import { afterEach, beforeAll, describe, expect, it, mock } from 'bun:test';
import { ChessBoard } from '@pkgs/chess-board/chess-board';
import { ChessBoardCanvasBootstrap } from '@pkgs/chess-board/chess-board-canvas-bootstrap';
import { preloadChessBoardCanvas } from '@pkgs/chess-board/chess-board-canvas-runtime';
import type {
  ChessBoardProps,
  Move,
} from '@pkgs/chess-board/chess-board-types';
import { ClockProvider, wallClock, wallTimers } from '@pkgs/clock';
import { AudioPlaybackProvider } from '@pkgs/sounds/audio-playback/audio-playback-context';
import type {
  AudioPlaybackPort,
  AudioPlayerHandle,
  AudioPlayerStatus,
} from '@pkgs/sounds/audio-playback/ports';
import { OverlayPortalProvider } from '@pkgs/ui-rn/components/overlay-portal';
import { ThemeProvider } from '@pkgs/ui-rn/theme';
import { act, type RenderResult, render } from '@testing-library/react-native';
import { type ReactElement, type ReactNode, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { dragPiece, tapSquare } from '../src/chess-board-gestures';

const BOARD_SIZE = 320;
const BOARD_TEST_ID = 'chess-board';

const ROOT_STYLE = { flex: 1 } as const;

const IDLE_STATUS: AudioPlayerStatus = {
  playing: false,
  isLoaded: true,
  duration: 1,
  currentTime: 0,
  didJustFinish: false,
};

function createNoopAudioPort(): AudioPlaybackPort {
  return {
    createPlayer() {
      const player: AudioPlayerHandle = {
        volume: 1,
        play() {},
        pause() {},
        async seekTo() {},
        replace() {},
        remove() {},
      };
      return player;
    },
    getStatus() {
      return IDLE_STATUS;
    },
    subscribeStatus(_player, listener) {
      listener(IDLE_STATUS);
      return () => {};
    },
    async setAudioModeAsync() {},
  };
}

function ChessBoardHarnessBody(props: ChessBoardProps): ReactNode {
  const audio = useMemo(() => createNoopAudioPort(), []);
  return (
    <ClockProvider clock={wallClock} timers={wallTimers}>
      <ThemeProvider colorScheme="light">
        <OverlayPortalProvider>
          <AudioPlaybackProvider port={audio}>
            <ChessBoardCanvasBootstrap>
              <ChessBoard
                size={BOARD_SIZE}
                testID={BOARD_TEST_ID}
                animations={false}
                {...props}
              />
            </ChessBoardCanvasBootstrap>
          </AudioPlaybackProvider>
        </OverlayPortalProvider>
      </ThemeProvider>
    </ClockProvider>
  );
}

/** Wrap ChessBoard for RNTL black-box tests. */
function ChessBoardHarness(props: ChessBoardProps): ReactElement {
  return (
    <GestureHandlerRootView style={ROOT_STYLE}>
      <ChessBoardHarnessBody {...props} />
    </GestureHandlerRootView>
  );
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const BLACK_TO_MOVE_FEN =
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

describe('ChessBoard black-box', () => {
  let tree: RenderResult | undefined;
  let onMove: ReturnType<typeof mock<(m: Move) => void>>;

  beforeAll(async () => {
    await preloadChessBoardCanvas();
  });

  afterEach(() => {
    tree?.unmount();
    tree = undefined;
  });

  async function mount(
    props: Partial<Parameters<typeof ChessBoardHarness>[0]> = {}
  ): Promise<RenderResult> {
    onMove = mock((_: Move) => undefined);
    const element: ReactElement = (
      <ChessBoardHarness fen={START_FEN} onMove={onMove} {...props} />
    );
    tree = render(element);
    await tree.findByTestId(BOARD_TEST_ID);
    return tree;
  }

  it('legal drag (end): e2 → e4 calls onMove', async () => {
    await mount();
    await act(async () => {
      dragPiece('e2', 'e4', { pointerUp: 'end' });
    });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]?.[0]).toMatchObject({
      from: 'e2',
      to: 'e4',
    });
  });

  // Expected fail until pan finalize commits last pointer (web CANCELLED w/o END).
  it.failing('legal drag (web pointer-up): e2 → e4 calls onMove', async () => {
    await mount();
    await act(async () => {
      dragPiece('e2', 'e4', { pointerUp: 'cancel' });
    });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]?.[0]).toMatchObject({
      from: 'e2',
      to: 'e4',
    });
  });

  it('illegal drag: e2 → e5 does not call onMove', async () => {
    await mount();
    await act(async () => {
      dragPiece('e2', 'e5');
    });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('empty origin: e4 → e5 does not call onMove', async () => {
    await mount();
    await act(async () => {
      dragPiece('e4', 'e5');
    });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('same square: e2 → e2 does not call onMove', async () => {
    await mount();
    await act(async () => {
      dragPiece('e2', 'e2');
    });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('tap-to-move: select e2 then tap e4 calls onMove', async () => {
    await mount();
    // Exclusive(pan, tap): pressing a piece activates pan immediately. A
    // same-square release cancels the drag but keeps selection; the follow-up
    // tap on an empty square is handled by Tap.
    await act(async () => {
      dragPiece('e2', 'e2', { pointerUp: 'end' });
    });
    await act(async () => {
      tapSquare('e4');
    });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]?.[0]).toMatchObject({
      from: 'e2',
      to: 'e4',
    });
  });

  it('non-interactive: drag e2 → e4 does not call onMove', async () => {
    await mount({ interactive: false });
    await act(async () => {
      dragPiece('e2', 'e4');
    });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('black orientation: drag e7 → e5 (pixels flipped) calls onMove', async () => {
    await mount({
      fen: BLACK_TO_MOVE_FEN,
      orientation: 'black',
    });
    await act(async () => {
      dragPiece('e7', 'e5', { orientation: 'black', pointerUp: 'end' });
    });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]?.[0]).toMatchObject({
      from: 'e7',
      to: 'e5',
    });
  });

  it('opponent piece: drag white pawn on black turn does not call onMove', async () => {
    await mount({ fen: BLACK_TO_MOVE_FEN });
    await act(async () => {
      dragPiece('e4', 'e5');
    });
    expect(onMove).not.toHaveBeenCalled();
  });
});
