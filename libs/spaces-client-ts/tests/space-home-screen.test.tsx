/** @jsxImportSource @solidjs/web */
/**
 * `/space/:id` before a game is picked is the catalogue's choosing screen:
 * the space's stage template with the launcher, wired to the registered
 * games. The app has no other game choice.
 */

import { afterEach, expect, mock, test } from 'bun:test';
import {
  SpaceHomeScreenView,
  spaceHomePeople,
  spaceLauncherGames,
} from '@libs/spaces-client-ts/space-home-screen-view';
import {
  type SpaceScreenChromeValue,
  SpaceScreenChromeValueProvider,
} from '@libs/spaces-client-ts/space-screen-chrome';
import { SpaceScreenFrame } from '@libs/spaces-client-ts/space-screen-frame';
import { GAMES } from '@libs/spaces-client-ts/spaces-story.example';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type {
  SpaceRole,
  SpacePerson as SpaceShellPerson,
} from '@pkgs/ui-root-client-ts/space-types';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

afterEach(cleanup);

const noop = (): void => {};

const AVERY: SpaceShellPerson = {
  id: 'avery',
  kind: 'person',
  name: 'avery',
  host: true,
};
const GUESTS: readonly SpaceShellPerson[] = ['sam', 'jo', 'kit', 'lee'].map(
  (name) => ({ id: name, kind: 'person', name })
);

function chrome(input: {
  role: SpaceRole;
  people: readonly SpaceShellPerson[];
  onSettings?: () => void;
  onPeople?: () => void;
}): SpaceScreenChromeValue {
  return {
    spaceId: 'space-1',
    spaceName: 'Friday game night',
    title: 'Friday game night',
    role: input.role,
    hostName: 'avery',
    people: input.people,
    hostOffline: false,
    status: 'ready',
    onBack: noop,
    backLabel: undefined,
    onMembers: input.onPeople ?? noop,
    onSettings: input.role === 'host' ? (input.onSettings ?? noop) : undefined,
    onMinimize: noop,
    onLeave: noop,
    onEnd: input.role === 'host' ? noop : undefined,
    onPersonAction: noop,
    personCapabilities: [],
    testIds: {
      back: Handles.spaceBackToSpaces,
      title: Handles.spaceTitle,
      people: Handles.spaceMembersButton,
      settings: Handles.spaceSettings,
      minimize: Handles.spaceClose,
      leave: Handles.spaceLeave,
      end: Handles.spaceEnd,
    },
  };
}

function mount(input: {
  role: SpaceRole;
  people: readonly SpaceShellPerson[];
  width?: number;
  onSelectGame?: (id: string) => void;
  onSettings?: () => void;
  onPeople?: () => void;
}): HTMLElement {
  const time = createHarnessClock();
  const { container } = renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider fixedLayout={{ width: input.width ?? 390, height: 844 }}>
        <SurfaceStackProvider>
          <SpaceScreenChromeValueProvider value={chrome(input)}>
            <SpaceScreenFrame>
              <SpaceHomeScreenView
                games={GAMES}
                canSelectGame={input.role === 'host'}
                onSelectGame={input.onSelectGame ?? noop}
              />
            </SpaceScreenFrame>
          </SpaceScreenChromeValueProvider>
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  return container;
}

const you = (person: SpaceShellPerson): SpaceShellPerson => ({
  ...person,
  you: true,
});

test('the screen is the catalogue template and launcher, in one shell', () => {
  const container = mount({ role: 'host', people: [you(AVERY)] });
  expect(
    container.querySelectorAll('[data-component="SpaceStageTemplate"]')
  ).toHaveLength(1);
  expect(
    container.querySelectorAll('[data-component="SpaceLauncher"]')
  ).toHaveLength(1);
  expect(screen.getAllByTestId(Handles.spaceTitle)).toHaveLength(1);
  // On the space's home the bar names the space, so everyone in it knows
  // where they are; the stage says what is happening (a game is chosen).
  expect(screen.getByTestId(Handles.spaceTitle).textContent).toBe(
    'Friday game night'
  );
  // The old list is gone: no menu rows, no second heading for the games.
  expect(
    container.querySelector('[data-component="MainMenuScreen"]')
  ).toBeNull();
  expect(screen.queryByText('Pick a game to play.')).toBeNull();
});

test('the host picks a registered game by its tile', () => {
  const onSelectGame = mock();
  mount({ role: 'host', people: [you(AVERY)], onSelectGame });
  expect(screen.getByText('Pick a game')).toBeTruthy();
  // Alone, a game for more people is still picked: bots or its own
  // choices fill the seats.
  fireEvent.click(screen.getByTestId(Handles.gameMenu('example-cards')));
  expect(onSelectGame).toHaveBeenCalledWith('example-cards');
});

// The spec "Friends watch a puzzle": more people than a game seats watch it.
test('with more people here than a game seats, the host still picks it', () => {
  const onSelectGame = mock();
  mount({ role: 'host', people: [you(AVERY), ...GUESTS], onSelectGame });
  for (const id of ['example-board', 'example-puzzle']) {
    const tile = screen.getByTestId(Handles.gameMenu(id));
    expect(tile.getAttribute('data-dimmed')).toBe('false');
    fireEvent.click(tile);
    expect(onSelectGame).toHaveBeenLastCalledWith(id);
  }
});

// regression: space-guest-invited-to-pick-game
test('a guest is told the host is choosing, and is not invited to pick', () => {
  for (const guests of [GUESTS.slice(0, 1), GUESTS]) {
    const onSelectGame = mock();
    const [me, ...others] = guests;
    if (me === undefined) throw new Error('a guest is needed');
    mount({ role: 'guest', people: [AVERY, you(me), ...others], onSelectGame });
    const told = screen.getByTestId(Handles.spaceHostChoosesGame);
    expect(told.textContent).toBe('avery is choosing a game');
    expect(screen.queryByText(/^Pick a game/)).toBeNull();
    expect(screen.queryByText(/suggest/i)).toBeNull();
    const tile = screen.getByTestId(Handles.gameMenu('example-board'));
    expect(tile.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(tile);
    expect(onSelectGame).not.toHaveBeenCalled();
    cleanup();
  }
});

// regression: game-chooser-hides-the-room
// regression: space-desktop-members-only-in-header
// regression: who-is-here-lone-person-row
// regression: game-chooser-faces-cropped-to-slivers
// regression: space-games-header-repeats-faces
test('who is here is the top bar\u2019s first action, never a row of faces, at any width', () => {
  for (const width of [390, 1440]) {
    const onPeople = mock();
    const container = mount({
      role: 'guest',
      people: [
        AVERY,
        ...GUESTS.map((guest, i) => (i === 0 ? you(guest) : guest)),
      ],
      width,
      onPeople,
    });
    // The room keeps the whole stage: no people row, no stack of faces, no
    // face drawn twice. Everyone is one press away in the bar.
    expect(
      container.querySelectorAll('[data-component="SpacePeopleRow"]')
    ).toHaveLength(0);
    expect(
      container.querySelectorAll('[data-component="SpacePersonCell"]')
    ).toHaveLength(0);
    expect(
      container.querySelector('[data-component="AvatarGroup"]')
    ).toBeNull();
    const people = screen.getByTestId(Handles.spaceMembersButton);
    expect(people.closest('[data-space-row="tools"]')).not.toBeNull();
    fireEvent.click(people);
    expect(onPeople).toHaveBeenCalledTimes(1);
    // The launcher still counts everyone here.
    expect(container.textContent).toContain('avery is choosing a game');
    cleanup();
  }
});

// regression: space-games-no-visible-invite
test('Settings opens the space administration for its host', () => {
  const onSettings = mock();
  mount({ role: 'host', people: [you(AVERY)], onSettings });
  fireEvent.click(screen.getByTestId(Handles.spaceSettings));
  expect(onSettings).toHaveBeenCalledTimes(1);
});

// regression: space-seats-explained-twice
// regression: game-list-watch-rule-unclear
// regression: space-game-list-repeats-spectator-rule
test('each tile says how many play and how many watch, once', () => {
  const container = mount({ role: 'host', people: [you(AVERY), ...GUESTS] });
  const text = container.textContent ?? '';
  expect(text).toContain('Pick a game for 5 players');
  expect(text).not.toMatch(/others watch|everyone else here/);
  const marks = GAMES.map(
    (game) => screen.getByTestId(Handles.gameMenu(game.id)).textContent ?? ''
  );
  expect(marks).toEqual([
    'Chess2 players · 3 watching',
    'Hearts4 players · 1 watching',
    'Light Cycles4 players · 1 watching',
    'NumberlinkSolo · 4 watching',
  ]);
});

// regression: guest-waiting-counts-another-room
test('a waiting guest reads every game\u2019s count as the host\u2019s tile says it', () => {
  const room = (role: SpaceRole): string[] => {
    const [guest, ...rest] = GUESTS.slice(0, 2);
    if (guest === undefined) throw new Error('a guest is needed');
    const people =
      role === 'host'
        ? [you(AVERY), guest, ...rest]
        : [AVERY, you(guest), ...rest];
    mount({ role, people });
    const marks = GAMES.map(
      (game) => screen.getByTestId(Handles.gameMenu(game.id)).textContent ?? ''
    );
    cleanup();
    return marks;
  };
  expect(room('guest')).toEqual(room('host'));
});

test('each registered game becomes one launcher tile with its harness handle', () => {
  expect(spaceLauncherGames(GAMES).map((game) => game.testId)).toEqual(
    GAMES.map((game) => Handles.gameMenu(game.id))
  );
  expect(() =>
    spaceLauncherGames([
      { id: 'x', title: 'X', bots: false, motif: 'not-a-motif' },
    ])
  ).toThrow('x: "not-a-motif" is not a game tile motif');
});

test('a game with several modes is one tile that opens its own mode', () => {
  const mode = (id: string, players: number, name: string) => ({
    id,
    title: `Trails ${name}`,
    players,
    bots: true,
    motif: 'trails',
    family: 'trails',
    mode: { game: 'Trails' },
  });
  const tiles = spaceLauncherGames([
    {
      id: 'draughts',
      title: 'Draughts',
      players: 2,
      bots: true,
      motif: 'checkered',
    },
    mode('trails', 2, 'Duel'),
    mode('trails-4', 4, 'Quad'),
    mode('trails-3', 3, 'Trio'),
  ]);
  expect(tiles.map((tile) => [tile.key, tile.name, tile.players])).toEqual([
    ['draughts', 'Draughts', { counts: [2], bots: true }],
    ['trails', 'Trails', { counts: [2, 3, 4], bots: true }],
  ]);
  expect(tiles[1]?.testId).toBe(Handles.gameMenu('trails'));
});

test('while choosing, the host is choosing, the rest watch, the quiet stay away', () => {
  expect(
    spaceHomePeople([
      AVERY,
      { id: 'sam', kind: 'person', name: 'sam' },
      { id: 'jo', kind: 'person', name: 'jo', status: 'away' },
    ]).map((person) => person.status)
  ).toEqual(['choosing', 'watching', 'away']);
});
