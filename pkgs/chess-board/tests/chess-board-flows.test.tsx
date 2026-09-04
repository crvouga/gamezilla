/**
 * Driver-based ChessBoardFlows suite: tap/drag via portable Driver APIs + probe.
 */

import { afterEach, beforeAll, describe, expect, it, mock } from 'bun:test';
import { ChessBoard } from '@pkgs/chess-board/chess-board';
import { ChessBoardCanvasBootstrap } from '@pkgs/chess-board/chess-board-canvas-bootstrap';
import { preloadChessBoardCanvas } from '@pkgs/chess-board/chess-board-canvas-runtime';
import { ChessBoardFlows } from '@pkgs/chess-board/chess-board-flows';
import type { Move } from '@pkgs/chess-board/chess-board-types';
import { ClockProvider, wallClock, wallTimers } from '@pkgs/clock';
import { AudioPlaybackProvider } from '@pkgs/sounds/audio-playback/audio-playback-context';
import type {
  AudioPlaybackPort,
  AudioPlayerHandle,
  AudioPlayerStatus,
} from '@pkgs/sounds/audio-playback/ports';
import { OverlayPortalProvider } from '@pkgs/ui/components/overlay-portal';
import { ThemeProvider } from '@pkgs/ui/theme';
import type { Driver } from '@pkgs/ui-testing';
import { createRenderedAppFromRntl, RntlDriver } from '@pkgs/ui-testing-rntl';
import { act, type RenderResult, render } from '@testing-library/react-native';
import { type ReactElement, type ReactNode, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const BOARD_SIZE = 320;
const BOARD_TEST_ID = 'chess-board';
const ROOT_STYLE = { flex: 1 } as const;
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

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

function HarnessBody(props: {
  fen: string;
  onMove: (m: Move) => void;
}): ReactNode {
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
                fen={props.fen}
                onMove={props.onMove}
                animations={false}
              />
            </ChessBoardCanvasBootstrap>
          </AudioPlaybackProvider>
        </OverlayPortalProvider>
      </ThemeProvider>
    </ClockProvider>
  );
}

function Harness(props: {
  fen: string;
  onMove: (m: Move) => void;
}): ReactElement {
  return (
    <GestureHandlerRootView style={ROOT_STYLE}>
      <HarnessBody {...props} />
    </GestureHandlerRootView>
  );
}

describe('ChessBoardFlows (Driver)', () => {
  let tree: RenderResult | undefined;
  let driver: Driver | undefined;
  let onMove: ReturnType<typeof mock<(m: Move) => void>>;

  beforeAll(async () => {
    await preloadChessBoardCanvas();
  });

  afterEach(async () => {
    await driver?.close();
    driver = undefined;
    tree?.unmount();
    tree = undefined;
  });

  async function mountFlows(): Promise<ChessBoardFlows> {
    onMove = mock((_: Move) => undefined);
    tree = render(<Harness fen={START_FEN} onMove={onMove} />);
    await tree.findByTestId(BOARD_TEST_ID);
    const app = createRenderedAppFromRntl(tree);
    driver = new RntlDriver({
      harness: { mount: async () => app },
      now: wallClock.now,
      timers: wallTimers,
    });
    await driver.launch();
    return new ChessBoardFlows(driver, BOARD_TEST_ID);
  }

  it('reads probe with piece x/y and drags e2→e4', async () => {
    const board = await mountFlows();
    await board.waitReady();
    const probe = await board.readProbe();
    expect(probe.size).toBe(BOARD_SIZE);
    expect(probe.orientation).toBe('white');
    await board.expectPieceAt('e2', 'wp');

    await act(async () => {
      await board.drag('e2', 'e4');
    });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]?.[0]).toMatchObject({ from: 'e2', to: 'e4' });
  });

  it('tap-to-move via square ratios', async () => {
    const board = await mountFlows();
    await board.waitReady();
    await act(async () => {
      await board.drag('e2', 'e2');
    });
    await act(async () => {
      await board.tapSquare('e4');
    });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]?.[0]).toMatchObject({ from: 'e2', to: 'e4' });
  });
});
