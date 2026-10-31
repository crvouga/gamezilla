/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { AVATAR_SIZES, Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { AvatarGroup } from '@pkgs/ui-root-client-ts/avatar-group';
import { AvatarHero } from '@pkgs/ui-root-client-ts/avatar-hero';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { List, ListItem } from '@pkgs/ui-root-client-ts/list';
import { MenuList } from '@pkgs/ui-root-client-ts/menu-list';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { PaginationControls } from '@pkgs/ui-root-client-ts/pagination-controls';
import { useRelativeTimeLabel } from '@pkgs/ui-root-client-ts/relative-time';
import { SoundIndicator } from '@pkgs/ui-root-client-ts/sound-indicator';
import { SpeakingAvatar } from '@pkgs/ui-root-client-ts/speaking-avatar';
import { StatusDot } from '@pkgs/ui-root-client-ts/status-dot';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { cssOf, renderUi } from './render';

function byComponent(name: string): HTMLElement {
  const el = document.querySelector(`[data-component="${name}"]`);
  if (!(el instanceof HTMLElement)) throw new Error(`missing ${name}`);
  return el;
}

describe('Badge', () => {
  test('renders label with intent/tone colors and pill radius', () => {
    renderUi(() => <Badge label="Beta" intent="success" tone="solid" />);
    const root = byComponent('Badge');
    expect(root).toHaveTextContent('Beta');
    expect(root).toHaveAttribute('data-intent', 'success');
    expect(root).toHaveAttribute('data-tone', 'solid');
    expect(root.className).toContain('badge');
  });

  test('sm size uses tighter padding than md', () => {
    renderUi(() => (
      <>
        <Badge label="a" size="sm" dataSet={{ component: 'BadgeSm' }} />
        <Badge label="b" size="md" dataSet={{ component: 'BadgeMd' }} />
      </>
    ));
    expect(byComponent('BadgeSm')).toHaveAttribute('data-size', 'sm');
    expect(byComponent('BadgeMd')).toHaveAttribute('data-size', 'md');
  });
});

describe('StatusDot', () => {
  test('is decorative without a label and an img with one', () => {
    renderUi(() => (
      <>
        <StatusDot status="online" dataSet={{ component: 'DotA' }} />
        <StatusDot
          status="offline"
          label="Offline"
          size={12}
          dataSet={{ component: 'DotB' }}
        />
      </>
    ));
    const a = byComponent('DotA');
    expect(a).toHaveAttribute('aria-hidden', 'true');
    expect(a).toHaveAttribute('data-status', 'online');
    const b = byComponent('DotB');
    expect(b).toHaveAttribute('role', 'img');
    expect(b).toHaveAttribute('aria-label', 'Offline');
    expect(cssOf(b)).toContain('width:12px');
    expect(b).toHaveAttribute('data-status', 'offline');
  });
});

describe('Avatar', () => {
  test('names the avatar by alt and draws the uri as its face', () => {
    renderUi(() => <Avatar uri="https://x/y.png" alt="Ada" size={40} />);
    const root = byComponent('Avatar');
    expect(screen.getByRole('img', { name: 'Ada' })).toBe(root);
    const img = root.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://x/y.png');
    expect(img).toHaveAttribute('alt', '');
    expect(cssOf(root)).toContain('width:40px');
    // The hairline ring is on by default, and round.
    expect(root.className).toMatch(/(^|\s)border(\s|$)/);
    expect(root.className).toContain('rounded-full');
  });

  test('named sizes resolve to their token diameter; ring is optional', () => {
    renderUi(() => (
      <>
        <Avatar size="lg" dataSet={{ component: 'AvLg' }} />
        <Avatar size="xs" ring={false} dataSet={{ component: 'AvBare' }} />
      </>
    ));
    expect(cssOf(byComponent('AvLg'))).toContain(`width:${AVATAR_SIZES.lg}px`);
    const bare = byComponent('AvBare');
    expect(cssOf(bare)).toContain(`width:${AVATAR_SIZES.xs}px`);
    expect(bare.className).not.toMatch(/(^|\s)border(\s|$)/);
  });

  test('initials sit on the quiet plate, never the blue', () => {
    renderUi(() => <Avatar initials="AB" dataSet={{ component: 'AvQuiet' }} />);
    expect(cssOf(byComponent('AvQuiet'))).toContain(
      'background-color:var(--ui-color-surface-muted)'
    );
  });

  test('falls back to initials and inlines svg markup', () => {
    renderUi(() => (
      <>
        <Avatar initials="AB" dataSet={{ component: 'AvInitials' }} />
        <Avatar
          svg="<svg viewBox='0 0 1 1'><rect/></svg>"
          dataSet={{ component: 'AvSvg' }}
        />
      </>
    ));
    expect(byComponent('AvInitials')).toHaveTextContent('AB');
    const img = byComponent('AvSvg').querySelector('img');
    expect(img?.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(decodeURIComponent(img?.getAttribute('src') ?? '')).toContain(
      '<rect/>'
    );
  });
});

describe('Avatar placeholder', () => {
  test('nobody yet is a filled head and shoulders on the quiet plate', () => {
    renderUi(() => (
      <>
        <Avatar size={48} dataSet={{ component: 'AvNobody' }} />
        <Avatar initials="AB" dataSet={{ component: 'AvSomebody' }} />
      </>
    ));
    const nobody = byComponent('AvNobody');
    expect(nobody).toHaveAttribute('data-placeholder', 'true');
    expect(cssOf(nobody)).toContain(
      'background-color:var(--ui-color-surface-muted)'
    );
    const glyph = nobody.querySelector('svg');
    expect(glyph?.getAttribute('aria-hidden')).toBe('true');
    // Drawn to the plate edge: no stroked icon floating in the middle.
    expect(glyph?.getAttribute('viewBox')).toBe('0 0 40 40');
    expect(glyph?.getAttribute('stroke')).toBeNull();
    expect(glyph?.querySelector('circle')).not.toBeNull();
    expect(byComponent('AvSomebody')).not.toHaveAttribute('data-placeholder');
  });
});

describe('AvatarGroup', () => {
  test('caps visible avatars and renders the overflow pill', () => {
    renderUi(() => (
      <AvatarGroup maxVisible={2} size={24}>
        <Avatar initials="A" />
        <Avatar initials="B" />
        <Avatar initials="C" />
        <Avatar initials="D" />
      </AvatarGroup>
    ));
    const root = byComponent('AvatarGroup');
    expect(root.querySelectorAll('[data-component="Avatar"]')).toHaveLength(2);
    expect(root).toHaveTextContent('+2');
  });

  test('becomes a button when onClick is provided', () => {
    const onClick = mock();
    renderUi(() => (
      <AvatarGroup onClick={onClick} aria-label="Members">
        <Avatar initials="A" />
      </AvatarGroup>
    ));
    const button = screen.getByRole('button', { name: 'Members' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('AvatarHero', () => {
  test('renders the corner action as a 44px button', () => {
    const onClick = mock();
    renderUi(() => (
      <AvatarHero
        size={96}
        action={{
          onClick,
          icon: <span>✎</span>,
          label: 'Edit avatar' as never,
        }}
      >
        <Avatar initials="Z" size={96} />
      </AvatarHero>
    ));
    const button = screen.getByRole('button', { name: 'Edit avatar' });
    expect(button.className).toMatch(/\bsize-11\b/);
    expect(button.className).toMatch(/\bmin-w-11\b/);
    expect(button.className).toMatch(/\bmin-h-11\b/);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('SoundIndicator', () => {
  test('exposes state via role=status and switches glyphs', () => {
    const [state, setState] = createSignal<'idle' | 'playing' | 'muted'>(
      'idle'
    );
    renderUi(() => <SoundIndicator state={state()} />);
    const status = screen.getByRole('status');
    const idleLabel = status.getAttribute('aria-label');
    setState('muted');
    expect(status.getAttribute('aria-label')).not.toBe(idleLabel);
    setState('playing');
    expect(status.querySelector('svg')).not.toBeNull();
  });
});

describe('SpeakingAvatar', () => {
  test('renders message bubble and hides mute toggle without a speaker', () => {
    renderUi(() => <SpeakingAvatar message="Your move" />);
    const root = byComponent('SpeakingAvatar');
    expect(root).toHaveTextContent('Your move');
    expect(root.querySelector('button')).toBeNull();
    const head = root.querySelector('img');
    expect(head?.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(head).toHaveAttribute('width', '96');
  });

  test('with a speaker, the head toggles mute (aria-pressed)', () => {
    const speaker = mock(() => ({
      isLoading: () => false,
      isSpeaking: () => false,
    }));
    renderUi(() => <SpeakingAvatar message="Hi" speaker={speaker} />);
    expect(speaker).toHaveBeenCalledTimes(1);
    const head = screen.getByRole('button');
    expect(head).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(head);
    expect(head).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen
        .getAllByRole('status')
        .some((node) => node.hasAttribute('aria-label'))
    ).toBe(true);
  });
});

describe('useRelativeTimeLabel', () => {
  test('buckets hours and days', () => {
    const [at, setAt] = createSignal(new Date(0).toISOString());
    const { clock } = renderUi(() => {
      const label = useRelativeTimeLabel(at);
      return <span data-testid="l">{label()}</span>;
    });
    clock.set(3 * 3_600_000);
    expect(screen.getByTestId('l')).toHaveTextContent('3h ago');
    setAt(new Date(0).toISOString());
    clock.set(2 * 86_400_000);
    expect(screen.getByTestId('l')).toHaveTextContent('2d ago');
  });
});

describe('List / ListItem', () => {
  test('renders a ul with li items and separators', () => {
    renderUi(() => (
      <List separator>
        <ListItem title="One" />
        <ListItem title="Two" subtitle="second" />
      </List>
    ));
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('UL');
    expect(list.querySelectorAll('li')).toHaveLength(2);
    expect(list).toHaveTextContent('second');
  });

  test('interactive items are buttons and report selection', () => {
    const onClick = mock();
    renderUi(() => (
      <List>
        <ListItem title="Pick" onClick={onClick} selected />
      </List>
    ));
    const button = screen.getByRole('button', { name: /Pick/ });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('MenuRow / MenuList / MenuSection', () => {
  test('settings rows are native buttons inside a group with a chevron', () => {
    const onClick = mock();
    renderUi(() => (
      <MenuSection title="Account" footer="Manage your account">
        <MenuRow title="Profile" onClick={onClick} />
        <MenuRow title="Static" value="v1" />
      </MenuSection>
    ));
    const menu = screen.getByRole('group');
    const item = screen.getByRole('button', { name: /Profile/ });
    expect(menu.contains(item)).toBe(true);
    expect(item.querySelector('svg')).not.toBeNull();
    const body = item.firstElementChild;
    if (!(body instanceof HTMLElement)) throw new Error('missing body');
    // At least 52px tall (`min-h-13`) on 16px insets: the start on the row,
    // the end on the text column that draws the hairline.
    expect(body.className).toMatch(/\bmin-h-13\b/);
    expect(body.className).toMatch(/\bpl-4\b/);
    const column = body.querySelector('.panelRule');
    expect(column?.className).toMatch(/\bpr-4\b/);
    fireEvent.click(item);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryAllByRole('button')).toHaveLength(1);
    expect(menu).toHaveTextContent('v1');
    expect(screen.getByText('Manage your account')).toBeInTheDocument();
  });

  test('selected row exposes aria-current and hideChevron drops the glyph', () => {
    renderUi(() => (
      <MenuList>
        <MenuRow title="Now" onClick={() => {}} selected hideChevron />
      </MenuList>
    ));
    const item = screen.getByRole('button');
    expect(item).toHaveAttribute('aria-current', 'true');
    expect(item.querySelector('svg')).toBeNull();
  });
});

describe('PaginationControls', () => {
  test('page buttons carry aria-current and nav buttons clamp', () => {
    const onPageChange = mock();
    renderUi(() => (
      <PaginationControls
        pageIndex={0}
        pageCount={3}
        onPageChange={onPageChange}
      />
    ));
    const current = screen.getByRole('button', { current: 'page' });
    expect(current).toHaveTextContent('1');
    expect(cssOf(current)).toMatch(/min-width:44px/);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: /3/ }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

// regression: ui-settings-list-command-menu-semantics
test('settings groups accept links, static details, and native actions', () => {
  const view = renderUi(() => (
    <MenuSection title="Preferences">
      <MenuRow title="Profile" href="#menu-row" />
      <MenuRow title="Version" value="v1" />
      <MenuRow title="Appearance" onClick={() => undefined} />
    </MenuSection>
  ));
  expect(
    view
      .getByRole('group')
      .contains(view.getByRole('link', { name: 'Profile' }))
  ).toBe(true);
  expect(view.getByRole('button', { name: 'Appearance' })).toBeInTheDocument();
  expect(view.queryByRole('menu')).toBeNull();
  expect(view.queryByRole('menuitem')).toBeNull();
  view.unmount();
});
