import { expect, test } from 'bun:test';
import { FrameActionsView } from '@libs/game-session-client-ts/game-frame-actions-view';
import {
  FRAME_NO_NEXT,
  FRAME_NO_PLAY,
} from '@libs/game-session-client-ts/game-frame-empty';
import type { FramePhase } from '@libs/game-session-client-ts/game-frame-view-types';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

test.each(['resign', 'cancel'] as const)(
  '%s confirmation survives the game finishing before acknowledgment',
  async (operation) => {
    // regression: game-finish-unmounts-confirmation
    const time = createHarnessClock();
    const [phase, setPhase] = createSignal<FramePhase>(
      operation === 'resign' ? 'active' : 'configuring'
    );
    let acknowledge: () => void = () => {
      throw new Error('No request to acknowledge');
    };
    const acknowledgment = new Promise<void>((resolve) => {
      acknowledge = resolve;
    });
    // Confirming finishes the game, which takes the command away at once.
    const choose = async () => {
      setPhase(operation === 'resign' ? 'completed' : 'cancelled');
      await acknowledgment;
    };
    const view = renderWithI18n(() => (
      <ClockProvider clock={time.clock} timers={time.timers}>
        <ThemeProvider
          colorScheme="light"
          fixedLayout={{ width: 390, height: 844 }}
        >
          <SurfaceStackProvider>
            <FrameActionsView
              phase={phase()}
              play={{
                ...FRAME_NO_PLAY,
                canResign: operation === 'resign' && phase() === 'active',
                canCancel: operation === 'cancel' && phase() === 'configuring',
              }}
              next={FRAME_NO_NEXT}
              onChoose={choose}
              onBack={() => undefined}
              onSeek={() => undefined}
            />
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
