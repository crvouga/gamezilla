/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { BackIconButton } from '@pkgs/ui/components/back-icon-button';
import {
  Button,
  type MutationStateTransition,
  useMutationButton,
} from '@pkgs/ui/components/button';
import { CloseIconButton } from '@pkgs/ui/components/close-icon-button';
import { FloatingActionButton } from '@pkgs/ui/components/floating-action-button';
import {
  ICON_BUTTON_MIN_HIT_TARGET,
  IconButton,
  iconButtonAvatarContentSize,
} from '@pkgs/ui/components/icon-button';
import {
  ChevronRightIcon,
  PlusIcon,
  SettingsIcon,
} from '@pkgs/ui/components/icons';
import {
  OverflowMenuButton,
  type OverflowMenuRenderProps,
} from '@pkgs/ui/components/overflow-menu-button';
import { fireEvent, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { cssOf, mustQuery, renderUi } from './support/render';

describe('Button', () => {
  test('renders a native button, fires onClick, and applies size', () => {
    const onClick = mock();
    renderUi(() => <Button title="Save" onClick={onClick} size="sm" />);
    const el = screen.getByRole('button', { name: 'Save' });
    expect(el.tagName).toBe('BUTTON');
    expect(el).toHaveAttribute('data-phase', 'idle');
    expect(el).toHaveAttribute('data-size', 'sm');
    expect(el).toHaveAttribute('data-face', 'primary');
    expect(el.className).toContain('btn');
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('variants change the surface: solid fills, outline borders', () => {
    renderUi(() => (
      <>
        <Button title="Solid" intent="primary" variant="solid" />
        <Button title="Outline" intent="primary" variant="outline" />
        <Button title="Ghost" variant="ghost" />
      </>
    ));
    expect(screen.getByRole('button', { name: 'Solid' })).toHaveAttribute(
      'data-face',
      'primary'
    );
    expect(screen.getByRole('button', { name: 'Outline' })).toHaveAttribute(
      'data-face',
      'primary-outline'
    );
    expect(screen.getByRole('button', { name: 'Ghost' })).toHaveAttribute(
      'data-face',
      'primary-ghost'
    );
  });

  test('disabled and loading block clicks; loading is aria-busy', () => {
    const onClick = mock();
    renderUi(() => (
      <>
        <Button title="Off" disabled onClick={onClick} />
        <Button title="Busy" loading onClick={onClick} loadingLabel="Saving…" />
      </>
    ));
    const off = screen.getByRole('button', { name: 'Off' });
    expect(off).toBeDisabled();
    fireEvent.click(off);
    const busy = screen.getByRole('button', { name: 'Saving…' });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(busy).toHaveAttribute('data-phase', 'loading');
    fireEvent.click(busy);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('fullWidth stretches and icon renders inline', () => {
    renderUi(() => <Button title="Add" icon={PlusIcon} fullWidth />);
    const el = screen.getByRole('button', { name: 'Add' });
    expect(el.className).toMatch(/w-full/);
    expect(el.querySelector('svg')).not.toBeNull();
  });

  test('endIcon stroke follows the button on-color (matches label)', () => {
    renderUi(() => (
      <Button
        title="Next"
        intent="success"
        endIcon={<ChevronRightIcon dataSet={{ testid: 'end' }} />}
      />
    ));
    const end = screen.getByTestId('end');
    expect(end.querySelector('svg')?.getAttribute('stroke')).toBe(
      'var(--ui-on-icon)'
    );
    expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute(
      'data-face',
      'success'
    );
  });
});

function MutationHarness(props: {
  operation: () => Promise<void>;
  onSuccess?: () => void;
  onPhaseChange?: (t: MutationStateTransition) => void;
  successHoldMs?: number;
}) {
  const m = useMutationButton({
    operation: () => props.operation(),
    labels: {
      idle: 'Join',
      loading: 'Joining…',
      success: 'Joined',
      error: 'Failed',
    },
    onSuccess: () => props.onSuccess?.(),
    onPhaseChange: (t) => props.onPhaseChange?.(t),
    get successHoldMs() {
      return props.successHoldMs;
    },
  });
  return <Button {...m.buttonProps} />;
}

describe('useMutationButton', () => {
  test('idle → loading → success → idle with the sim clock', async () => {
    let resolve: () => void = () => {};
    const operation = mock(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        })
    );
    const onSuccess = mock();
    const phases: string[] = [];
    const { clock } = renderUi(() => (
      <MutationHarness
        operation={operation}
        onSuccess={onSuccess}
        onPhaseChange={(t) => phases.push(t.to)}
        successHoldMs={500}
      />
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    const busy = await screen.findByRole('button', { name: 'Joining…' });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    // Clicking while loading does not re-run.
    fireEvent.click(busy);
    expect(operation).toHaveBeenCalledTimes(1);

    resolve();
    const done = await screen.findByRole('button', { name: 'Joined' });
    expect(done).toHaveAttribute('data-phase', 'success');
    expect(onSuccess).not.toHaveBeenCalled();

    clock.advance(499);
    expect(onSuccess).not.toHaveBeenCalled();
    clock.advance(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Join' })).toHaveAttribute(
      'data-phase',
      'idle'
    );
    expect(phases).toEqual(['loading', 'success', 'idle']);
  });

  test('error phase shows the error face and retries on click', async () => {
    const operation = mock<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('nope'))
      .mockResolvedValueOnce(undefined);
    renderUi(() => <MutationHarness operation={operation} />);
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    const failed = await screen.findByRole('button', { name: 'Failed' });
    expect(failed).toHaveAttribute('data-phase', 'error');
    fireEvent.click(failed);
    expect(operation).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByRole('button', { name: 'Joined' })
    ).toBeInTheDocument();
  });
});

describe('IconButton family', () => {
  test('IconButton is a ≥44px button named by its label with a tooltip', () => {
    const onClick = mock();
    renderUi(() => (
      <IconButton label="Settings" size={32} onClick={onClick}>
        <SettingsIcon size={16} />
      </IconButton>
    ));
    const el = screen.getByRole('button', { name: 'Settings' });
    const css = cssOf(el);
    expect(css).toContain(`min-width:${ICON_BUTTON_MIN_HIT_TARGET}px`);
    expect(css).toContain(`min-height:${ICON_BUTTON_MIN_HIT_TARGET}px`);
    const tooltip = screen.getByRole('tooltip', { hidden: true });
    expect(el).toHaveAttribute('aria-describedby', tooltip.id);
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('tooltip="none" skips the bubble; disabled blocks clicks', () => {
    const onClick = mock();
    renderUi(() => (
      <IconButton label="Muted" tooltip="none" disabled onClick={onClick}>
        <SettingsIcon size={16} />
      </IconButton>
    ));
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
    const el = screen.getByRole('button', { name: 'Muted' });
    expect(el).toBeDisabled();
    fireEvent.click(el);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('avatar variant keeps the disc at `size` with ring padding', () => {
    renderUi(() => (
      <IconButton label="Me" variant="avatar" size={40} tooltip="none">
        <span style={{ width: `${iconButtonAvatarContentSize(40)}px` }} />
      </IconButton>
    ));
    const el = screen.getByRole('button', { name: 'Me' });
    expect(el).toHaveAttribute('data-variant', 'avatar');
    const disc = mustQuery('[data-component="IconButtonDisc"]');
    expect(cssOf(disc)).toContain('height:40px');
    expect(cssOf(disc)).toContain('padding:2px');
    expect(iconButtonAvatarContentSize(40)).toBe(36);
  });

  test('Back / Close icon buttons have localized names', () => {
    const back = mock();
    const close = mock();
    renderUi(() => (
      <>
        <BackIconButton onClick={back} />
        <CloseIconButton onClick={close} />
      </>
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('FloatingActionButton', () => {
  test('round FAB is ≥56px and extended FAB shows its label', () => {
    const onClick = mock();
    renderUi(() => (
      <>
        <FloatingActionButton aria-label="New" onClick={onClick} />
        <FloatingActionButton aria-label="Compose" label="Compose" />
      </>
    ));
    const fab = screen.getByRole('button', { name: 'New' });
    expect(cssOf(fab)).toContain('min-height:56px');
    fireEvent.click(fab);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Compose' })).toHaveTextContent(
      'Compose'
    );
  });

  test('feedback="loading" is aria-busy and inert', () => {
    const onClick = mock();
    renderUi(() => (
      <FloatingActionButton
        aria-label="Go"
        feedback="loading"
        onClick={onClick}
      />
    ));
    const fab = screen.getByRole('button', { name: 'Go' });
    expect(fab).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(fab);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('OverflowMenuButton', () => {
  test('exposes a menu trigger and hands content to renderMenu', () => {
    const renderMenu = mock<(menu: OverflowMenuRenderProps) => JSX.Element>(
      () => null
    );
    const onAction = mock();
    renderUi(() => (
      <OverflowMenuButton
        aria-label="More"
        header={{ title: 'More' }}
        actions={[
          { id: 'a', label: 'Alpha', onClick: onAction, endsGroup: true },
          { id: 'b', label: 'Beta', onClick: () => {} },
        ]}
        renderMenu={renderMenu}
      />
    ));
    const trigger = screen.getByRole('button', { name: 'More' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const last = renderMenu.mock.calls.at(-1)?.[0];
    expect(last?.open).toBe(true);
    expect(last?.content.rows.map((r) => r.type)).toEqual([
      'item',
      'divider',
      'item',
    ]);
  });

  test('renders nothing without actions', () => {
    renderUi(() => (
      <OverflowMenuButton
        aria-label="More"
        header={{ title: 'x' }}
        actions={[]}
      />
    ));
    expect(screen.queryByRole('button')).toBeNull();
  });
});
