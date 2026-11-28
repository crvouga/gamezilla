import { afterEach, expect, test } from 'bun:test';
import {
  GameStageBack,
  type GameStageBackProps,
} from '@libs/spaces-client-ts/game-stage-back';
import {
  SpacesNavProvider,
  useSpacesNavBack,
} from '@libs/spaces-client-ts/spaces-nav-context';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal, flush } from 'solid-js';

afterEach(cleanup);

function mount(
  props: Pick<
    GameStageBackProps,
    'gameId' | 'action' | 'submit' | 'returnToSpaceScreen'
  >
) {
  const time = createHarnessClock();
  function Chrome() {
    const back = useSpacesNavBack();
    return (
      <button type="button" onClick={() => back()?.()}>
        Back
      </button>
    );
  }
  return renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider fixedLayout={{ width: 390, height: 844 }}>
        <SurfaceStackProvider>
          <SpacesNavProvider>
            <Chrome />
            <GameStageBack
              {...props}
              message="You lose this game."
              backWithinGame={() => false}
            />
          </SpacesNavProvider>
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
}

const back = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
const confirm = () => fireEvent.click(screen.getByTestId('game-back-confirm'));

test('an unanswered resignation stays on the board, a refusal retries there, and only success goes back', async () => {
  let submissions = 0;
  let returns = 0;
  const pending = Promise.withResolvers<void>();
  mount({
    gameId: 'quoridor-bot',
    action: 'resign',
    submit: () => (++submissions === 1 ? pending.promise : Promise.resolve()),
    returnToSpaceScreen: () => {
      returns++;
    },
  });
  back();
  confirm();
  back();
  expect(submissions).toBe(1);
  expect(returns).toBe(0);
  pending.reject(new Error('Connection needed'));
  await screen.findByText('Connection needed');
  expect(returns).toBe(0);
  confirm();
  await Promise.resolve();
  await Promise.resolve();
  expect(submissions).toBe(2);
  expect(returns).toBe(1);
});

test('a confirmation from the previous game cannot resign a rematch', () => {
  const [id, setId] = createSignal('first');
  const submitted: string[] = [];
  mount({
    get gameId() {
      return id();
    },
    action: 'resign',
    submit: async () => {
      submitted.push(id());
    },
    returnToSpaceScreen: () => undefined,
  });
  back();
  expect(screen.getByTestId('game-back-confirm')).toBeDefined();
  setId('rematch');
  flush();
  expect(screen.queryByTestId('game-back-confirm')).toBeNull();
  back();
  fireEvent.click(screen.getByTestId('game-back-stay'));
  expect(submitted).toEqual([]);
});
