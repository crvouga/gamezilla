/** @jsxImportSource @solidjs/web */

import { describe, expect, mock, test } from 'bun:test';
import {
  type SpaceGameFit,
  spaceGameFit,
  spaceGameFitDimmed,
} from '@pkgs/ui-root-client-ts/space-game-fit';
import {
  SpaceActionBar,
  SpaceInGameTemplate,
} from '@pkgs/ui-root-client-ts/space-in-game-template';
import { SpaceLauncher } from '@pkgs/ui-root-client-ts/space-launcher';
import { SpacePeopleRow } from '@pkgs/ui-root-client-ts/space-people-row';
import {
  SPACE_PERSON_CAPABILITIES,
  type SpacePersonActionEntry,
  type SpacePersonActionsInput,
  spacePersonActions as spacePersonActionsBare,
} from '@pkgs/ui-root-client-ts/space-person-actions';
import { SpaceShell } from '@pkgs/ui-root-client-ts/space-shell';
import type {
  SpaceGame,
  SpaceGameAction,
  SpaceGamePlay,
  SpacePerson,
  SpaceRole,
} from '@pkgs/ui-root-client-ts/space-types';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { fireEvent, screen, within } from '@solidjs/testing-library';
import { renderUi } from './render';

/** A variable, not a literal: a literal `role` reads as an ARIA role to jsx-a11y. */
const GUEST: SpaceRole = 'guest';
const HOST_ROLE: SpaceRole = 'host';
const ME: SpacePerson = { id: 'me', kind: 'person', name: 'ana', you: true };
const OTHER: SpacePerson = { id: 'bob', kind: 'person', name: 'bob' };
const BOT: SpacePerson = { id: 'bot', kind: 'bot', name: 'Bot 1' };
const SEAT: SpacePerson = { id: 'seat', kind: 'openSeat', name: 'Open seat' };

const action = (
  id: string,
  tone?: 'destructive',
  emphasis?: 'primary'
): SpaceGameAction => ({ id, label: id, tone, emphasis, onPress: () => {} });

/** Every optional action available, as a product that can do them all. */
function spacePersonActions(
  input: SpacePersonActionsInput
): readonly SpacePersonActionEntry[] {
  return spacePersonActionsBare({
    capabilities: SPACE_PERSON_CAPABILITIES,
    ...input,
  });
}

function ids(entries: readonly SpacePersonActionEntry[]): string[] {
  return entries.map((entry) =>
    entry.source === 'game' ? `game:${entry.action.id}` : entry.id
  );
}

describe('spacePersonActions', () => {
  test('a guest sees only what anyone may do on another person', () => {
    expect(
      ids(
        spacePersonActions({ pressed: OTHER, viewer: 'guest', phase: 'inGame' })
      )
    ).toEqual(['sendMessage', 'mute', 'seeDetails']);
  });

  test('the host also gets host-only actions, destructive last', () => {
    expect(
      ids(
        spacePersonActions({ pressed: OTHER, viewer: 'host', phase: 'inGame' })
      )
    ).toEqual([
      'sendMessage',
      'mute',
      'seeDetails',
      'makeHost',
      'removeFromSpace',
    ]);
    expect(
      ids(
        spacePersonActions({ pressed: BOT, viewer: 'host', phase: 'settingUp' })
      )
    ).toEqual([
      'seeDetails',
      'changeDifficulty',
      'swapForPerson',
      'removeBot',
      'removeSeat',
    ]);
    expect(
      ids(
        spacePersonActions({
          pressed: SEAT,
          viewer: 'host',
          phase: 'settingUp',
        })
      )
    ).toEqual(['inviteFriend', 'addBot', 'removeSeat']);
    expect(
      ids(
        spacePersonActions({
          pressed: SEAT,
          viewer: 'guest',
          phase: 'settingUp',
        })
      )
    ).toEqual(['inviteFriend']);
  });

  test('yourself: ready up only while setting up, as the toggle of your state', () => {
    expect(
      ids(
        spacePersonActions({ pressed: ME, viewer: 'guest', phase: 'settingUp' })
      )
    ).toEqual(['readyUp', 'muteMic', 'seeMyDetails', 'leaveSeat']);
    expect(
      ids(
        spacePersonActions({
          pressed: { ...ME, status: 'ready' },
          viewer: 'guest',
          phase: 'settingUp',
        })
      )[0]
    ).toBe('notReady');
    expect(
      ids(
        spacePersonActions({ pressed: ME, viewer: 'guest', phase: 'choosing' })
      )
    ).toEqual(['muteMic', 'seeMyDetails']);
  });

  test("the game's actions come first; every destructive one goes last", () => {
    const entries = spacePersonActions({
      pressed: ME,
      viewer: 'guest',
      phase: 'inGame',
      game: [action('offer-draw'), action('resign', 'destructive')],
    });
    expect(ids(entries)).toEqual([
      'game:offer-draw',
      'muteMic',
      'seeMyDetails',
      'game:resign',
      'leaveSeat',
    ]);
  });

  test('actions the product cannot carry out yet are hidden by default', () => {
    expect(
      ids(
        spacePersonActionsBare({
          pressed: OTHER,
          viewer: 'host',
          phase: 'inGame',
        })
      )
    ).toEqual(['seeDetails', 'removeFromSpace']);
    expect(
      ids(
        spacePersonActionsBare({
          pressed: ME,
          viewer: 'guest',
          phase: 'choosing',
        })
      )
    ).toEqual(['seeMyDetails']);
  });

  test('a remote player gets no space or host actions', () => {
    expect(
      ids(
        spacePersonActions({
          pressed: { id: 'far', kind: 'remote', name: 'cy' },
          viewer: 'host',
          phase: 'inGame',
        })
      )
    ).toEqual(['seeDetails']);
  });

  test('a mute toggle carries its state', () => {
    const [mute] = spacePersonActions({
      pressed: { ...OTHER, muted: true },
      viewer: 'guest',
      phase: 'inGame',
    }).filter((entry) => entry.source === 'space' && entry.id === 'mute');
    expect(mute?.source === 'space' ? mute.on : undefined).toBe(true);
  });
});

describe('spaceGameFit', () => {
  const cases: readonly [string, SpaceGameFit][] = [
    ['fits', spaceGameFit({ counts: [2, 3, 4], bots: false }, 2, 'guest')],
    ['bots', spaceGameFit({ counts: [4], bots: true }, 2, 'host')],
    ['needs', spaceGameFit({ counts: [4], bots: true }, 2, 'guest')],
    ['solo', spaceGameFit({ counts: [1], bots: false }, 2, 'host')],
    ['tooMany', spaceGameFit({ counts: [2], bots: false }, 3, 'host')],
  ];
  test.each(cases)('%p', (kind, fit) => {
    expect(fit.kind).toBe(kind as SpaceGameFit['kind']);
  });

  test('the host fills missing seats with bots; only unplayable games dim', () => {
    expect(spaceGameFit({ counts: [4], bots: true }, 2, 'host')).toEqual({
      kind: 'bots',
      target: 4,
      bots: 2,
    });
    expect(spaceGameFitDimmed({ kind: 'bots', target: 4, bots: 2 })).toBe(
      false
    );
    expect(spaceGameFitDimmed({ kind: 'needs', target: 4 })).toBe(true);
    // More people than seats watch: neither a full game nor a solo one dims.
    expect(spaceGameFitDimmed({ kind: 'tooMany', max: 2 })).toBe(false);
    expect(spaceGameFitDimmed({ kind: 'solo' })).toBe(false);
  });
});

describe('SpaceShell', () => {
  test('row 1 has one space menu: it ends in Leave for a guest, End for the host', () => {
    const onLeave = mock();
    const onEnd = mock();
    const shell = (role: 'host' | 'guest') => (
      <SurfaceStackProvider>
        <SpaceShell
          spaceName="bob's space"
          role={role}
          onBack={() => {}}
          onLeave={onLeave}
          onEnd={onEnd}
        >
          <p>{'stage'}</p>
        </SpaceShell>
      </SurfaceStackProvider>
    );
    const guest = renderUi(() => shell('guest'));
    // Nothing of the space's way out sits loose in the row.
    const row = document.querySelector('[data-space-row="actions"]');
    expect(row?.querySelectorAll('button')).toHaveLength(2);
    // On a wide window the menu shows its short word; its name stays whole.
    expect(row?.textContent).toBe("Back to spacesbob's spaceMenu");
    expect(screen.queryByRole('menuitem')).toBeNull();
    const opener = screen.getByRole('button', { name: 'Space menu' });
    expect(opener.getAttribute('aria-haspopup')).toBe('menu');
    fireEvent.click(opener);
    expect(screen.getByRole('menu', { name: 'Space menu' })).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'End space' })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Leave space' }));
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    guest.unmount();
    renderUi(() => shell('host'));
    fireEvent.click(screen.getByRole('button', { name: 'Space menu' }));
    expect(screen.queryByRole('menuitem', { name: 'Leave space' })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'End space' }));
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      "bob's space"
    );
  });
});

describe('SpacePeopleRow', () => {
  const people: readonly SpacePerson[] = [
    { ...OTHER, host: true, status: 'settingUp' },
    { ...ME, status: 'notReady', muted: true },
    BOT,
  ];

  test('each cell says its badges in words and opens its menu', () => {
    const onPerson = mock();
    renderUi(() => (
      <SpacePeopleRow
        people={people}
        phase="settingUp"
        onPerson={onPerson}
        onInvite={() => {}}
      />
    ));
    const you = screen.getByRole('button', {
      name: 'You, Guest, Not ready, Muted',
    });
    expect(you.getAttribute('aria-haspopup')).toBe('menu');
    fireEvent.click(you);
    expect(onPerson).toHaveBeenCalledWith('me', expect.any(HTMLElement));
    expect(
      screen.getByRole('button', { name: 'bob, Host, Setting up' })
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Invite' })).toBeDefined();
    const host = document.querySelector(
      '[data-person="bob"] [data-component="Avatar"]'
    );
    expect(host?.getAttribute('data-accent-ring')).toBe('true');
  });

  test('in game: player rings, the turn badge, no Invite', () => {
    renderUi(() => (
      <SpacePeopleRow
        people={people}
        phase="inGame"
        seat={(person) =>
          person.id === 'bob'
            ? { color: 'player1', turn: true, data: { value: '10:00' } }
            : { color: 'player2' }
        }
        onPerson={() => {}}
        onInvite={() => {}}
      />
    ));
    expect(screen.queryByRole('button', { name: 'Invite' })).toBeNull();
    const bob = document.querySelector('[data-person="bob"]');
    expect(bob?.getAttribute('data-status')).toBe('turn');
    expect(
      bob
        ?.querySelector('[data-component="Avatar"]')
        ?.getAttribute('data-seat-color')
    ).toBe('player1');
    expect(bob?.textContent).toContain('10:00');
  });
});

describe('SpaceActionBar', () => {
  // regression: space-waiting-status-with-page-announcer
  test('one to three actions, or one waiting line', () => {
    const first = renderUi(() => (
      <SpaceActionBar
        actions={[action('a'), action('b'), action('c'), action('d')]}
      />
    ));
    expect(
      document.querySelectorAll('[data-component="SpaceActionBar"] button')
    ).toHaveLength(3);
    first.unmount();
    renderUi(() => <SpaceActionBar actions={[]} waiting="bob is thinking" />);
    const actions = screen.getByRole('group', { name: 'Game actions' });
    expect(within(actions).getByRole('status')).toHaveTextContent(
      'bob is thinking'
    );
  });
});

const GAME: SpaceGame & { play: SpaceGamePlay } = {
  key: 'g',
  name: 'Any Game',
  motif: 'trails',
  tagline: 'Any line',
  players: { counts: [2], bots: false },
  setup: { settings: [] },
  play: {
    status: 'Your move',
    board: <div data-testid="board" />,
    actions: [
      action('resign', 'destructive'),
      action('play', undefined, 'primary'),
    ],
  },
};

describe('SpaceInGameTemplate', () => {
  test('fills the stage with the game: status, board, action bar', () => {
    renderUi(() => (
      <SpaceInGameTemplate
        game={GAME}
        role={GUEST}
        people={[ME, OTHER]}
        spaceName="bob's space"
        onBack={() => {}}
        onLeave={() => {}}
        onEnd={() => {}}
        onPersonAction={() => {}}
        onInvite={() => {}}
      />
    ));
    expect(screen.getByRole('heading', { name: 'Your move' })).toBeDefined();
    expect(screen.getByTestId('board')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'resign' }).getAttribute('data-face')
    ).toBe('danger-outline');
    expect(
      screen.getByRole('button', { name: 'play' }).getAttribute('data-face')
    ).toBe('primary');
    expect(screen.queryByRole('button', { name: 'Invite' })).toBeNull();
  });
});

describe('SpaceLauncher', () => {
  test('a guest suggests a game that fits; one too few are here for cannot be suggested', () => {
    const onSuggest = mock();
    renderUi(() => (
      <SpaceLauncher
        role={GUEST}
        hostName="bob"
        present={2}
        lookingAt="b"
        games={[
          {
            key: 'a',
            name: 'Alpha',
            motif: 'cards',
            players: { counts: [4], bots: true },
          },
          {
            key: 'b',
            name: 'Beta',
            motif: 'trails',
            players: { counts: [2], bots: false },
          },
        ]}
        onSuggest={onSuggest}
      />
    ));
    expect(screen.getByText('bob is choosing a game')).toBeDefined();
    expect(screen.getByText('bob is looking')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(onSuggest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Beta/ }));
    expect(onSuggest).toHaveBeenCalledWith('b');
  });

  test('the host picks any game; more people than seats watch, too few is dimmed', () => {
    const onChoose = mock();
    renderUi(() => (
      <SpaceLauncher
        role={HOST_ROLE}
        hostName="bob"
        present={3}
        games={[
          {
            key: 'duel',
            name: 'Duel',
            motif: 'checkered',
            players: { counts: [2], bots: false },
            testId: 'tile-duel',
          },
          {
            key: 'solo',
            name: 'Alone',
            motif: 'paths',
            players: { counts: [1], bots: false },
          },
          {
            key: 'four',
            name: 'Four',
            motif: 'cards',
            players: { counts: [4], bots: false },
          },
        ]}
        onChoose={onChoose}
      />
    ));
    const duel = screen.getByTestId('tile-duel');
    expect(duel.getAttribute('data-dimmed')).toBe('false');
    expect(duel.textContent).toBe('Duel2 players · 1 watching');
    const four = screen.getByRole('button', { name: /Four/ });
    expect(four.getAttribute('data-dimmed')).toBe('true');
    expect(four.textContent).toBe('FourNeeds 4');
    for (const name of [/Duel/, /Alone/, /Four/]) {
      const tile = screen.getByRole('button', { name });
      expect(tile.getAttribute('aria-disabled')).toBeNull();
      fireEvent.click(tile);
    }
    expect(onChoose.mock.calls).toEqual([['duel'], ['solo'], ['four']]);
  });

  test('where guests cannot suggest, their tiles only show and nothing offers it', () => {
    const view = renderUi(() => (
      <SpaceLauncher
        role={GUEST}
        hostName=""
        present={2}
        testIds={{ status: 'status' }}
        games={[
          {
            key: 'b',
            name: 'Beta',
            motif: 'trails',
            players: { counts: [2], bots: false },
          },
        ]}
      />
    ));
    expect(screen.getByTestId('status').textContent).toBe(
      'The host is choosing a game'
    );
    expect(view.container.textContent).not.toMatch(/suggest/i);
    expect(
      screen.getByRole('button', { name: /Beta/ }).getAttribute('aria-disabled')
    ).toBe('true');
  });
});
