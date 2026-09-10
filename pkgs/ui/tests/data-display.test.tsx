/** @jsxImportSource solid-js */
import { AVATAR_BORDER_WIDTH, Avatar } from '@pkgs/ui/components/avatar';
import { AvatarGroup } from '@pkgs/ui/components/avatar-group';
import { AvatarHero } from '@pkgs/ui/components/avatar-hero';
import { Badge } from '@pkgs/ui/components/badge';
import { List, ListItem } from '@pkgs/ui/components/list';
import { MenuList, MenuRow, MenuSection } from '@pkgs/ui/components/menu-row';
import { PaginationControls } from '@pkgs/ui/components/pagination-controls';
import {
  RelativeTime,
  useRelativeTimeLabel,
} from '@pkgs/ui/components/relative-time';
import { SoundIndicator } from '@pkgs/ui/components/sound-indicator';
import { SpeakingAvatar } from '@pkgs/ui/components/speaking-avatar';
import { StatusDot } from '@pkgs/ui/components/status-dot';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { describe, expect, test, vi } from 'vitest';
import { cssOf, renderUi } from './support/render';

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
    const css = cssOf(root);
    expect(css).toContain('background-color:var(--ui-color-success)');
    expect(root.className).toMatch(/rounded-\[9999px\]/);
  });

  test('sm size uses tighter padding than md', () => {
    renderUi(() => (
      <>
        <Badge label="a" size="sm" dataSet={{ component: 'BadgeSm' }} />
        <Badge label="b" size="md" dataSet={{ component: 'BadgeMd' }} />
      </>
    ));
    expect(cssOf(byComponent('BadgeSm'))).toContain('padding:2px6px');
    expect(cssOf(byComponent('BadgeMd'))).toContain('padding:3px8px');
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
    expect(cssOf(a)).toContain('background-color:var(--ui-color-success)');
    const b = byComponent('DotB');
    expect(b).toHaveAttribute('role', 'img');
    expect(b).toHaveAttribute('aria-label', 'Offline');
    expect(cssOf(b)).toContain('width:12px');
    expect(cssOf(b)).toContain('background-color:var(--ui-color-destructive)');
  });
});

describe('Avatar', () => {
  test('renders an <img> with alt for uri sources', () => {
    renderUi(() => <Avatar uri="https://x/y.png" alt="Ada" size={40} />);
    const img = screen.getByRole('img', { name: 'Ada' });
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', 'https://x/y.png');
    const root = byComponent('Avatar');
    expect(cssOf(root)).toContain('width:40px');
    expect(cssOf(root)).toContain(`border-width:${AVATAR_BORDER_WIDTH}px`);
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
    const onClick = vi.fn();
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
    const onClick = vi.fn();
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
    const css = cssOf(button);
    expect(css).toMatch(/min-width:44px|width:44px/);
    expect(css).toMatch(/min-height:44px|height:44px/);
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
    const speaker = vi.fn(() => ({
      isLoading: () => false,
      isSpeaking: () => false,
    }));
    renderUi(() => <SpeakingAvatar message="Hi" speaker={speaker} />);
    expect(speaker).toHaveBeenCalledTimes(1);
    const head = screen.getByRole('button');
    expect(head).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(head);
    expect(head).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveAttribute('aria-label');
  });
});

describe('RelativeTime', () => {
  test('renders <time datetime> and ticks with injected timers', () => {
    const at = new Date(0).toISOString();
    const { clock } = renderUi(() => <RelativeTime at={at} />);
    const el = byComponent('RelativeTime');
    expect(el.tagName).toBe('TIME');
    expect(el).toHaveAttribute('datetime', at);
    expect(el).toHaveTextContent('just now');
    clock.advance(5 * 60_000);
    // The label only re-evaluates on the injected interval tick.
    expect(el).toHaveTextContent('5m ago');
  });

  test('useRelativeTimeLabel buckets hours and days', () => {
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
    const onClick = vi.fn();
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
  test('rows are menuitems inside role=menu with a chevron', () => {
    const onClick = vi.fn();
    renderUi(() => (
      <MenuSection title="Account" footer="Manage your account">
        <MenuRow title="Profile" onClick={onClick} />
        <MenuRow title="Static" value="v1" />
      </MenuSection>
    ));
    const menu = screen.getByRole('menu');
    const item = screen.getByRole('menuitem', { name: /Profile/ });
    expect(menu.contains(item)).toBe(true);
    expect(item.querySelector('svg')).not.toBeNull();
    const body = item.firstElementChild;
    if (!(body instanceof HTMLElement)) throw new Error('missing body');
    expect(cssOf(body)).toMatch(/min-height:60px/);
    fireEvent.click(item);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryAllByRole('menuitem')).toHaveLength(1);
    expect(menu).toHaveTextContent('v1');
    expect(screen.getByText('Manage your account')).toBeInTheDocument();
  });

  test('selected row exposes aria-current and hideChevron drops the glyph', () => {
    renderUi(() => (
      <MenuList>
        <MenuRow title="Now" onClick={() => {}} selected hideChevron />
      </MenuList>
    ));
    const item = screen.getByRole('menuitem');
    expect(item).toHaveAttribute('aria-current', 'true');
    expect(item.querySelector('svg')).toBeNull();
  });
});

describe('PaginationControls', () => {
  test('page buttons carry aria-current and nav buttons clamp', () => {
    const onPageChange = vi.fn();
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
