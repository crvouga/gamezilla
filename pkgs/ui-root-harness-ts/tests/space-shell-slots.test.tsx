/** @jsxImportSource @solidjs/web */

import { describe, expect, mock, test } from 'bun:test';
import {
  SpaceActionBar,
  SpaceInGameTemplate,
  spaceActionBarSplit,
} from '@pkgs/ui-root-client-ts/space-in-game-template';
import { SpacePeopleRow } from '@pkgs/ui-root-client-ts/space-people-row';
import { SPACE_PERSON_CAPABILITIES } from '@pkgs/ui-root-client-ts/space-person-actions';
import { SpacePeople } from '@pkgs/ui-root-client-ts/space-person-menu/space-people';
import { SpaceSetupTemplate } from '@pkgs/ui-root-client-ts/space-setup-template';
import { SpaceShell } from '@pkgs/ui-root-client-ts/space-shell';
import { SpaceStageTemplate } from '@pkgs/ui-root-client-ts/space-stage-template';
import type {
  SpaceGame,
  SpaceGameAction,
  SpaceGamePlay,
  SpacePerson,
  SpaceRole,
} from '@pkgs/ui-root-client-ts/space-types';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { fireEvent, screen } from '@solidjs/testing-library';
import type { JSX } from '@solidjs/web';
import { renderUi } from './render';

/** Sheets open over the stage through the app's surface stack. */
function renderSpace(ui: () => JSX.Element) {
  return renderUi(() => <SurfaceStackProvider>{ui()}</SurfaceStackProvider>);
}

/** A variable, not a literal: a literal `role` reads as an ARIA role to jsx-a11y. */
const GUEST: SpaceRole = 'guest';
const HOST: SpaceRole = 'host';
const ME: SpacePerson = { id: 'me', kind: 'person', name: 'ana', you: true };
const OTHER: SpacePerson = { id: 'bob', kind: 'person', name: 'bob' };

const action = (id: string, testId?: string): SpaceGameAction => ({
  id,
  label: id,
  testId,
  onPress: () => {},
});

const CHROME = {
  spaceName: "bob's space",
  onBack: () => {},
  onMembers: () => {},
  onMinimize: () => {},
  onPersonAction: () => {},
};

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
    actions: [action('play')],
  },
};

describe('SpaceShell slots', () => {
  test('test ids, the back label, the notice and the space controls', () => {
    const settings = mock();
    const people = mock();
    const onLeave = mock();
    renderSpace(() => (
      <SpaceShell
        {...CHROME}
        onLeave={onLeave}
        role={GUEST}
        backLabel="Back to Chess"
        title="Chess"
        onMembers={people}
        onSettings={settings}
        notice={<p data-testid="notice">{'The host is offline'}</p>}
        testIds={{
          back: 'b',
          title: 't',
          people: 'p',
          settings: 'r',
          leave: 'l',
        }}
      >
        <p>{'stage'}</p>
      </SpaceShell>
    ));
    expect(screen.getByTestId('b').getAttribute('aria-label')).toBe(
      'Back to Chess'
    );
    // The bar is titled with the screen, not with the space.
    expect(screen.getByTestId('t').textContent).toBe('Chess');
    expect(
      screen.getByTestId('p').closest('[data-space-row="tools"]')
    ).not.toBeNull();
    fireEvent.click(screen.getByTestId('p'));
    expect(people).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('notice')).toBeDefined();
    fireEvent.click(screen.getByTestId('r'));
    expect(settings).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('l'));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  test('back names its default destination and Minimize is always available', () => {
    renderSpace(() => (
      <SpaceShell {...CHROME} role={HOST}>
        <p>{'stage'}</p>
      </SpaceShell>
    ));
    expect(
      screen.getByRole('button', { name: 'Back to spaces' })
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Minimize space' })
    ).toBeDefined();
    // No notice: no alert floats over the space.
    expect(document.querySelector('[data-component="SpaceNotice"]')).toBeNull();
  });
});

describe('SpaceActionBar overflow', () => {
  test('past three actions, the third control is More', () => {
    const many = ['a', 'b', 'c', 'd'].map((id) => action(id, `t-${id}`));
    expect(spaceActionBarSplit(many).shown.map((a) => a.id)).toEqual([
      'a',
      'b',
    ]);
    expect(spaceActionBarSplit(many.slice(0, 3)).more).toEqual([]);
    renderSpace(() => <SpaceActionBar actions={many} moreTestId="more" />);
    expect(
      document.querySelectorAll('[data-component="SpaceActionBar"] button')
    ).toHaveLength(3);
    fireEvent.click(screen.getByTestId('more'));
    expect(screen.getByTestId('t-d')).toBeDefined();
  });
});

describe('SpaceInGameTemplate slots', () => {
  test('a result replaces the status and actions; the overlay covers the stage', () => {
    renderSpace(() => (
      <SpaceInGameTemplate
        {...CHROME}
        game={GAME}
        role={GUEST}
        people={[ME, OTHER]}
        result={{ status: 'You won', actions: [action('rematch', 'again')] }}
        overlay={<p data-testid="countdown">{'3'}</p>}
        aside={{ label: 'Moves', content: () => <p>{'1. e4'}</p> }}
      />
    ));
    expect(screen.getByRole('heading', { name: 'You won' })).toBeDefined();
    expect(screen.getByTestId('again')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'play' })).toBeNull();
    expect(screen.getByTestId('countdown')).toBeDefined();
    expect(screen.queryByText('1. e4')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Moves' }));
    expect(screen.getByText('1. e4')).toBeDefined();
  });
});

describe('SpaceSetupTemplate slots', () => {
  test('a watching viewer gets no ready toggle; the board shows', () => {
    renderSpace(() => (
      <SpaceSetupTemplate
        {...CHROME}
        game={GAME}
        role={GUEST}
        hostName="bob"
        people={[{ ...OTHER, host: true }]}
        watchers={[ME]}
        readyNote="You are watching this game."
        board={<div data-testid="fleet" />}
      />
    ));
    expect(screen.getByTestId('fleet')).toBeDefined();
    expect(screen.queryByRole('button', { name: "I'm ready" })).toBeNull();
    expect(screen.getByText('You are watching this game.')).toBeDefined();
  });
});

describe('SpaceStageTemplate', () => {
  test('a page in the stage under the space, with no row of people', () => {
    renderSpace(() => (
      <SpaceStageTemplate {...CHROME} role={GUEST}>
        <p>{'History'}</p>
      </SpaceStageTemplate>
    ));
    expect(screen.getByText('History')).toBeDefined();
    expect(
      document
        .querySelector('[data-space-row="stage"]')
        ?.getAttribute('data-scroll')
    ).toBe('scroll');
    expect(document.querySelectorAll('[data-person]')).toHaveLength(0);
    expect(document.querySelector('[data-space-row="people"]')).toBeNull();
  });
});

describe('SpacePeopleRow art and test ids', () => {
  test('avatar art, a test id and a remote player', () => {
    renderSpace(() => (
      <SpacePeopleRow
        people={[
          { ...OTHER, svg: '<svg data-art="bob"></svg>', testId: 'cell-bob' },
          { id: 'far', kind: 'remote', name: 'cy' },
        ]}
        phase="inGame"
        onPerson={() => {}}
      />
    ));
    expect(
      screen.getByTestId('cell-bob').querySelector('img')?.getAttribute('src')
    ).toStartWith('data:image/svg+xml');
    expect(screen.getByRole('button', { name: 'cy, Opponent' })).toBeDefined();
  });
});

describe('SpacePeople', () => {
  test('pressing a person opens their actions as a menu against the avatar', () => {
    const onPersonAction = mock();
    renderSpace(() => (
      <SpacePeople
        people={[ME, OTHER]}
        viewer={HOST}
        phase="choosing"
        capabilities={SPACE_PERSON_CAPABILITIES}
        onPersonAction={onPersonAction}
      />
    ));
    const cell = screen.getByRole('button', { name: /^bob/ });
    expect(cell.getAttribute('aria-haspopup')).toBe('menu');
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(cell);
    expect(cell.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu', { name: 'bob' })).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    const remove = screen.getByRole('menuitem', { name: 'Remove from space' });
    fireEvent.click(remove);
    expect(onPersonAction).toHaveBeenCalledWith('bob', 'removeFromSpace');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(cell.getAttribute('aria-expanded')).toBe('false');
  });
});
