import { expect, test } from 'bun:test';
import { FrameActions } from '@libs/game-session-client-ts/game-frame-play';
import type { CustomGameReview } from '@libs/game-session-client-ts/use-custom-game-review';
import type { CustomGameScreenModel } from '@libs/game-session-client-ts/use-custom-game-screen';
import {
  type CustomGame,
  newCustomGame,
} from '@libs/game-session-shared-ts/custom-game-state';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { TurnGamesProvider } from '@pkgs/turn-game-client-ts/turn-games-context';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

test.each(['resign', 'cancel'] as const)(
  '%s confirmation survives the game finishing before acknowledgment',
  async (operation) => {
    // regression: game-finish-unmounts-confirmation
    const time = createHarnessClock();
    const [game, setGame] = createSignal<CustomGame>({
      ...newCustomGame('game', 'alice', 'initial'),
      status:
        operation === 'resign' ? ('active' as const) : ('configuring' as const),
    });
    let acknowledge: () => void = () => {
      throw new Error('No request to acknowledge');
    };
    const acknowledgment = new Promise<void>((resolve) => {
      acknowledge = resolve;
    });
    const model = {
      current: game,
      mySide: () => 'white',
      myId: () => 'alice',
      canPlay: () => game().status === 'active',
      canCancel: () => operation === 'cancel',
      canCreate: () => false,
      sharedAvailable: () => false,
      choose: async () => {
        setGame((current) => ({
          ...current,
          status: operation === 'resign' ? 'completed' : 'cancelled',
          outcome: 'black wins by resignation',
        }));
        await acknowledgment;
      },
    } as unknown as CustomGameScreenModel;
    const view = renderWithI18n(() => (
      <ClockProvider clock={time.clock} timers={time.timers}>
        <ThemeProvider
          colorScheme="light"
          fixedLayout={{ width: 390, height: 844 }}
        >
          <SurfaceStackProvider>
            <TurnGamesProvider rules={createTurnGames([])} presentations={[]}>
              <FrameActions
                model={model}
                board={{
                  session: () => null,
                  position: () => game().fen,
                  interactive: () => false,
                  orientation: () => 'white',
                }}
                review={{} as CustomGameReview}
              />
            </TurnGamesProvider>
          </SurfaceStackProvider>
        </ThemeProvider>
      </ClockProvider>
    ));
    fireEvent.click(view.getByTestId(`custom-game-${operation}`));
    fireEvent.click(view.getByTestId(`custom-game-${operation}-confirm`));
    expect(view.queryByRole('dialog')).not.toBeNull();
    acknowledge();
    const done = await view.findByTestId(`custom-game-${operation}-done`);
    expect(view.getByText('Game finished')).toBeInTheDocument();
    fireEvent.click(done);
    expect(view.queryByRole('dialog')).toBeNull();
  }
);
