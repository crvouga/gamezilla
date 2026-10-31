/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { AvatarGroup } from '@pkgs/ui-root-client-ts/avatar-group';
import { Badge, HostBadge, LiveBadge } from '@pkgs/ui-root-client-ts/badge';
import { BadgedIcon } from '@pkgs/ui-root-client-ts/badged-icon';
import { List, ListItem } from '@pkgs/ui-root-client-ts/list';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StatPill } from '@pkgs/ui-root-client-ts/stat-pill';
import { screen } from '@solidjs/testing-library';
import { For } from 'solid-js';
import { cssOf, mustQuery, renderUi } from './render';

function inside(root: Element, selector: string): Element {
  const el = root.querySelector(selector);
  if (el === null) throw new Error(`No ${selector} inside`);
  return el;
}

function avatar(id: string): HTMLElement {
  const el = mustQuery(`[data-component="${id}"]`);
  if (!(el instanceof HTMLElement)) throw new Error(`missing ${id}`);
  return el;
}

describe('Avatar kinds', () => {
  test('a bot is the bot glyph and is announced as a bot', () => {
    renderUi(() => (
      <>
        <Avatar kind="bot" dataSet={{ component: 'Bot' }} />
        <Avatar kind="bot" alt="Stockfish" dataSet={{ component: 'Named' }} />
      </>
    ));
    const bot = avatar('Bot');
    expect(screen.getByRole('img', { name: 'Bot' })).toBe(bot);
    expect(bot).toHaveAttribute('data-kind', 'bot');
    expect(bot).not.toHaveAttribute('data-placeholder');
    expect(bot.querySelector('[data-component="Icon"]')).not.toBeNull();
    expect(bot.querySelector('svg[viewBox="0 0 40 40"]')).toBeNull();
    expect(screen.getByRole('img', { name: 'Stockfish, bot' })).toBe(
      avatar('Named')
    );
  });

  test('a guest is a person placeholder with the guest mark', () => {
    renderUi(() => <Avatar kind="guest" dataSet={{ component: 'Guest' }} />);
    const guest = avatar('Guest');
    expect(screen.getByRole('img', { name: 'Guest' })).toBe(guest);
    expect(guest).toHaveAttribute('data-placeholder', 'true');
    expect(guest.querySelector('svg[viewBox="0 0 40 40"]')).not.toBeNull();
    expect(guest.querySelector('[data-avatar-mark="guest"]')).not.toBeNull();
  });

  test('an empty seat is a dashed outline ring with nobody in it', () => {
    renderUi(() => (
      <Avatar kind="emptySeat" dataSet={{ component: 'EmptySeat' }} />
    ));
    const seat = avatar('EmptySeat');
    expect(screen.getByRole('img', { name: 'Open seat' })).toBe(seat);
    expect(seat.className).toMatch(/\bborder-dashed\b/);
    expect(seat.className).toMatch(/\bborder-outline\b/);
    expect(seat.querySelector('svg')).toBeNull();
    expect(seat.querySelector('img')).toBeNull();
    expect(cssOf(seat)).not.toContain('background-color');
  });

  test('a person without alt is decorative; with alt it is named', () => {
    renderUi(() => (
      <>
        <Avatar initials="AB" dataSet={{ component: 'Anon' }} />
        <Avatar initials="JD" alt="Jane Doe" dataSet={{ component: 'Jane' }} />
      </>
    ));
    expect(avatar('Anon')).not.toHaveAttribute('role');
    expect(avatar('Anon')).toHaveAttribute('data-kind', 'person');
    expect(screen.getByRole('img', { name: 'Jane Doe' })).toBe(avatar('Jane'));
  });

  test('your avatar is the soft blue plate with soft blue initials', () => {
    renderUi(() => <Avatar you initials="ME" dataSet={{ component: 'You' }} />);
    const you = avatar('You');
    expect(you).toHaveAttribute('data-you', 'true');
    expect(cssOf(you)).toContain(
      'background-color:var(--ui-color-tint-subtle)'
    );
    expect(cssOf(inside(you, 'span.text'))).toContain(
      'color:var(--ui-color-on-primary-soft)'
    );
  });

  test('a seat color is the ring, replacing the hairline', () => {
    renderUi(() => (
      <>
        <Avatar seatColor="player3" dataSet={{ component: 'Seat' }} />
        <Avatar
          kind="emptySeat"
          seatColor="player5"
          dataSet={{ component: 'OpenSeat' }}
        />
      </>
    ));
    const seat = avatar('Seat');
    expect(seat).toHaveAttribute('data-seat-color', 'player3');
    expect(seat.className).toMatch(/\bborder-player3\b/);
    expect(seat.className).toMatch(/\bborder-2\b/);
    expect(seat.className).not.toMatch(/\bborder-border\b/);
    const open = avatar('OpenSeat');
    expect(open.className).toMatch(/\bborder-player5\b/);
    expect(open.className).toMatch(/\bborder-dashed\b/);
  });
});

describe('Fixed tags', () => {
  test('LIVE says the word Live (caps are styling) on the live fill with a dot', () => {
    renderUi(() => <LiveBadge />);
    const live = avatar('Badge');
    expect(live).toHaveTextContent(/^Live$/);
    expect(live).toHaveAttribute('data-intent', 'live');
    expect(live).toHaveAttribute('data-tone', 'solid');
    const dot = inside(live, '[data-component="StatusDot"]');
    expect(cssOf(dot)).toContain('background-color:var(--ui-color-on-live)');
  });

  test('Host is a neutral tag', () => {
    renderUi(() => <HostBadge size="sm" />);
    const host = avatar('Badge');
    expect(host).toHaveTextContent(/^Host$/);
    expect(host).toHaveAttribute('data-intent', 'neutral');
    expect(host).toHaveAttribute('data-size', 'sm');
  });

  test('no other badge can be live', () => {
    renderUi(() => <Badge label="Online" intent="neutral" dot="online" />);
    expect(avatar('Badge')).toHaveAttribute('data-intent', 'neutral');
  });
});

describe('Compact counts', () => {
  test('a stat pill shows 12.4K and keeps the exact count', () => {
    renderUi(() => <StatPill value={12_400} label="watching" />);
    const pill = avatar('StatPill');
    expect(pill).toHaveTextContent('12.4K');
    expect(pill).toHaveTextContent('watching');
    expect(pill).toHaveAttribute('data-value', '12400');
    expect(pill.className).toMatch(/\bbg-surface-muted\b/);
  });

  test('an active stat pill is the soft blue', () => {
    renderUi(() => <StatPill value={3} label="points" active />);
    const pill = avatar('StatPill');
    expect(pill).toHaveTextContent('3');
    expect(pill.className).toMatch(/\bbg-tint-subtle\b/);
  });

  test('a badged icon compacts a number count and hides zero', () => {
    renderUi(() => (
      <>
        <BadgedIcon badge={12_400}>
          <span data-testid="big" />
        </BadgedIcon>
        <BadgedIcon badge={0}>
          <span data-testid="zero" />
        </BadgedIcon>
      </>
    ));
    const badges = document.querySelectorAll('[data-component="Badge"]');
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent('12.4K');
  });

  test('an avatar group compacts its overflow count', () => {
    const crowd = Array.from({ length: 1_243 }, (_, i) => i);
    renderUi(() => (
      <AvatarGroup maxVisible={3} size={24}>
        <For each={crowd}>{() => <span />}</For>
      </AvatarGroup>
    ));
    expect(avatar('AvatarGroup')).toHaveTextContent('+1.2K');
  });
});

describe('Rows and panels', () => {
  test('the section label is the sectionLabel role above a panel', () => {
    renderUi(() => (
      <MenuSection title="Players">
        <MenuRow title="Jane" />
      </MenuSection>
    ));
    const label = screen.getByRole('heading', { name: 'Players' });
    expect(label.className).toMatch(/\btextSectionLabel\b/);
    expect(label.className).toMatch(/\bline-clamp-1\b/);
  });

  test('long row titles end in an ellipsis and the hairline starts past an avatar', () => {
    const long =
      'Maximiliana Alexandrovna Konstantinopolskaya-Featherstonehaugh';
    renderUi(() => (
      <>
        <MenuSection title="People">
          <MenuRow title="First" />
          <MenuRow title={long} leading={<Avatar kind="guest" size={40} />} />
        </MenuSection>
        <List>
          <ListItem title="One" />
          <ListItem title={long} leading={<Avatar kind="bot" size={40} />} />
        </List>
      </>
    ));
    for (const title of screen.getAllByText(long)) {
      expect(title.className).toMatch(/\bline-clamp-1\b/);
      const column = title.closest('.panelRule');
      expect(column).not.toBeNull();
      // The avatar sits before the text column, so the column's hairline
      // starts past it.
      expect(
        column?.parentElement?.querySelector('[data-component="Avatar"]')
      ).not.toBeNull();
      expect(column?.querySelector('[data-component="Avatar"]')).toBeNull();
    }
  });
});
