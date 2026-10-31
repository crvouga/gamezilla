import { afterEach, expect, test } from 'bun:test';
import { GameFrameOptions } from '@libs/game-session-client-ts/game-frame-options';
import {
  frameStartLine,
  frameViewerNotice,
} from '@libs/game-session-client-ts/game-frame-setup-copy';
import { frameStartReason } from '@libs/game-session-client-ts/game-frame-start-reason';
import {
  frameOpenSides,
  frameViewerRole,
} from '@libs/game-session-client-ts/game-frame-viewer';
import {
  type CustomGame,
  type CustomGameParticipant,
  customGameStartable,
  newCustomGame,
} from '@libs/game-session-shared-ts/custom-game-state';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import type { GameOptionGroup } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

afterEach(cleanup);

const THREE: readonly GameSide[] = ['white', 'black', 'red'];

function seated(
  kinds: readonly CustomGameParticipant['kind'][],
  ready: readonly GameSide[] = []
): CustomGame {
  const game = newCustomGame('g', 'alice', 'start', THREE);
  const seats = Object.fromEntries(
    THREE.map((side, index) => [
      side,
      { kind: kinds[index] ?? 'open', person: `p${String(index)}` },
    ])
  );
  return { ...game, ...seats, ready: [...ready] };
}

test('the viewer role comes from the decisions and where the person sits', () => {
  const role = (facts: Partial<Parameters<typeof frameViewerRole>[0]>) =>
    frameViewerRole({
      configures: false,
      joins: true,
      seated: false,
      openSeats: 1,
      ...facts,
    });
  expect(role({ configures: true, seated: true })).toBe('host');
  expect(role({ configures: true, openSeats: 0 })).toBe('host');
  expect(role({ seated: true, openSeats: 0 })).toBe('seated');
  expect(role({})).toBe('member');
  expect(role({ openSeats: 0 })).toBe('watcher');
  expect(role({ joins: false })).toBe('watcher');
});

test('each role is told its place at the table in its own words', () => {
  expect(frameViewerNotice('host', 0)).toBeNull();
  expect(frameViewerNotice('seated', 0)).toBeNull();
  expect(frameViewerNotice('member', 2)).toBe(
    'Sit in an open seat to play, or stay to watch.'
  );
  expect(frameViewerNotice('watcher', 0)).toBe(
    "All seats are taken. You'll watch."
  );
  expect(frameViewerNotice('watcher', 1)).toBe("You're watching this game.");
  for (const role of ['member', 'watcher'] as const)
    expect(frameViewerNotice(role, 0)).not.toContain('!');
});

test('the open seats are the ones nobody holds, in seat order', () => {
  expect(frameOpenSides(null)).toEqual([]);
  expect(frameOpenSides(seated(['person', 'open', 'open']))).toEqual([
    'black',
    'red',
  ]);
  expect(frameOpenSides(seated(['person', 'bot', 'closed']))).toEqual([]);
});

test('a start reason names the first blocker and its count', () => {
  const line = (game: CustomGame) => frameStartLine(frameStartReason(game));
  expect(line(seated(['person', 'open', 'open']))).toBe(
    '2 seats are still open.'
  );
  expect(line(seated(['person', 'bot', 'closed']))).toBe(
    '1 closed seat needs a player or a bot.'
  );
  expect(line(seated(['person', 'invitation', 'bot'], ['white']))).toBe(
    'Waiting for 1 invitation to be answered.'
  );
  expect(line(seated(['person', 'person', 'bot'], []))).toBe(
    'Waiting for 2 people to be ready.'
  );
  expect(line(seated(['person', 'local', 'bot'], ['white']))).toBe(
    'Ready to start.'
  );
});

test('a game has no start reason exactly when it can start', () => {
  const kinds: CustomGameParticipant['kind'][] = [
    'person',
    'bot',
    'local',
    'invitation',
    'open',
    'closed',
  ];
  const readiness = [0, 1, 2, 3, 4, 5, 6, 7].map((mask) =>
    THREE.filter((_, index) => (mask & (1 << index)) !== 0)
  );
  for (const first of kinds)
    for (const second of kinds)
      for (const third of kinds)
        for (const ready of readiness) {
          const game = seated([first, second, third], ready);
          expect(frameStartReason(game) === null).toBe(
            customGameStartable(game)
          );
        }
});

const TARGET: GameOptionGroup = {
  kind: 'count',
  id: 'target-score',
  label: () => 'Round wins to win',
  min: 1,
  max: 9,
  default: 3,
  read: (position) => Number(position.split(':')[0]),
  encode: String,
};
const SIZE: GameOptionGroup = {
  kind: 'choice',
  id: 'size',
  label: () => 'Board',
  options: [
    { value: 's', label: () => 'Small' },
    { value: 'l', label: () => 'Large' },
  ],
  default: 's',
  read: (position) => position.split(':')[1] ?? 's',
  encode: (value) => `size=${value}`,
};

function renderOptions(editable: boolean) {
  const [position, setPosition] = createSignal('3:s');
  const applied: string[] = [];
  let settle: () => void = () => undefined;
  const apply = (choice: string) =>
    new Promise<void>((resolve) => {
      applied.push(choice);
      settle = () => {
        const [target, size] = position().split(':');
        setPosition(
          choice.startsWith('size=')
            ? `${target}:${choice.slice(5)}`
            : `${choice}:${size}`
        );
        resolve();
      };
    });
  renderWithI18n(() => (
    <GameFrameOptions
      options={[TARGET, SIZE]}
      position={position()}
      editable={editable}
      apply={apply}
    />
  ));
  return { applied, settle: () => settle() };
}

test('the host steps a count option, which applies the choice it encodes', async () => {
  const options = renderOptions(true);
  const value = screen.getByTestId('custom-game-option-target-score-value');
  expect(value.getAttribute('aria-valuenow')).toBe('3');
  expect(
    screen.getByTestId('custom-game-option-target-score-range').textContent
  ).toBe('Choose from 1 to 9.');
  fireEvent.click(
    screen.getByTestId('custom-game-option-target-score-increase')
  );
  // The chosen value shows while it is applied, and a second step waits.
  expect(value.getAttribute('aria-valuenow')).toBe('4');
  fireEvent.click(
    screen.getByTestId('custom-game-option-target-score-increase')
  );
  expect(value.getAttribute('aria-valuenow')).toBe('5');
  expect(options.applied).toEqual(['4']);
  options.settle();
  await Promise.resolve();
  await Promise.resolve();
  expect(options.applied).toEqual(['4', '5']);
  options.settle();
  await Promise.resolve();
  await Promise.resolve();
  expect(value.getAttribute('aria-valuenow')).toBe('5');
});

test('the host picks a choice option as a chip', () => {
  const options = renderOptions(true);
  fireEvent.click(screen.getByTestId('custom-game-option-size-l'));
  expect(options.applied).toEqual(['size=l']);
});

test('someone who may not set the game up reads every option, with no control', () => {
  renderOptions(false);
  expect(screen.queryByTestId('custom-game-option-target-score-value')).toBe(
    null
  );
  expect(screen.queryByTestId('custom-game-option-size-l')).toBe(null);
  expect(screen.getByText('Round wins to win')).toBeTruthy();
  expect(screen.getByText('3')).toBeTruthy();
  expect(screen.getByText('Small')).toBeTruthy();
});
