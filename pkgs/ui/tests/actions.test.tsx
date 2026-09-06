/** @jsxImportSource solid-js */

import { asLocalized } from '@pkgs/i18n';
import { CHIP_HEIGHT, Chip } from '@pkgs/ui/components/chip';
import { ChipGroup } from '@pkgs/ui/components/chip-group';
import {
  CopyToClipboardField,
  DEFAULT_COPIED_RESET_MS,
} from '@pkgs/ui/components/copy-to-clipboard-field';
import { FormActionsFooter } from '@pkgs/ui/components/form-actions-footer';
import {
  arraysEqualAsSets,
  MultiSelectSwatchGrid,
  toggleSwatch,
} from '@pkgs/ui/components/multi-select-swatch';
import { NumberStepper, stepValue } from '@pkgs/ui/components/number-stepper';
import {
  SegmentedControl,
  segmentIndicatorCss,
} from '@pkgs/ui/components/segmented-control';
import { SocialSignInButton } from '@pkgs/ui/components/social-sign-in-button';
import { PillTabBar, TabStrip } from '@pkgs/ui/components/tab-strip';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { describe, expect, test, vi } from 'vitest';
import { cssOf, renderUi } from './support/render';

function mustAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`no item at ${index}`);
  return item;
}

describe('Chip / ChipGroup', () => {
  test('Chip is a toggle button with aria-pressed and fixed height', () => {
    const onClick = vi.fn();
    renderUi(() => <Chip label="All" selected onClick={onClick} />);
    const el = screen.getByRole('button', { name: 'All' });
    expect(el).toHaveAttribute('aria-pressed', 'true');
    expect(cssOf(el)).toContain(`height:${CHIP_HEIGHT}px`);
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('ChipGroup is a radiogroup that selects exactly one option', () => {
    const onSelect = vi.fn();
    renderUi(() => (
      <ChipGroup
        label="Filter"
        options={[
          { key: 'a', label: 'Alpha' },
          { key: 'b', label: 'Beta' },
        ]}
        selected="a"
        onSelect={onSelect}
      />
    ));
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Beta' }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });
});

describe('SegmentedControl', () => {
  test('radiogroup semantics + indicator geometry', () => {
    const [sel, setSel] = createSignal<'x' | 'y'>('x');
    renderUi(() => (
      <SegmentedControl
        aria-label="Mode"
        segments={[
          { key: 'x', label: 'X' },
          { key: 'y', label: 'Y' },
        ]}
        selected={sel()}
        onSelect={setSel}
      />
    ));
    expect(screen.getByRole('radiogroup', { name: 'Mode' })).toBeVisible();
    const y = screen.getByRole('radio', { name: 'Y' });
    expect(y).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(y);
    expect(y).toHaveAttribute('aria-checked', 'true');
    const geo = segmentIndicatorCss(1, 2);
    expect(geo.width).toContain('/ 2)');
    expect(geo.left).toContain('1 *');
  });
});

describe('TabStrip', () => {
  test('tablist/tab roles, aria-selected, select + close', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderUi(() => (
      <TabStrip
        aria-label="Apps"
        items={[
          { id: 'one', label: 'One' },
          { id: 'two', label: 'Two', onClose },
        ]}
        selectedId="one"
        onSelect={onSelect}
      />
    ));
    expect(screen.getByRole('tablist', { name: 'Apps' })).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    fireEvent.click(mustAt(tabs, 1));
    expect(onSelect).toHaveBeenCalledWith('two');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test('PillTabBar alias is the same component', () => {
    expect(PillTabBar).toBe(TabStrip);
  });
});

describe('NumberStepper', () => {
  test('spinbutton aria + increment/decrement clamp', () => {
    renderUi(() => {
      const [v, setV] = createSignal(9);
      return (
        <NumberStepper
          label="Players"
          value={v()}
          onChange={setV}
          min={1}
          max={10}
        />
      );
    });
    const spin = screen.getByRole('spinbutton', { name: 'Players' });
    expect(spin).toHaveAttribute('aria-valuenow', '9');
    expect(spin).toHaveAttribute('aria-valuemax', '10');
    const inc = screen.getByRole('button', { name: 'Increase Players' });
    fireEvent.click(inc);
    expect(spin).toHaveAttribute('aria-valuenow', '10');
    fireEvent.click(inc);
    expect(spin).toHaveAttribute('aria-valuenow', '10');
    expect(inc).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Players' }));
    expect(spin).toHaveAttribute('aria-valuenow', '9');
    expect(stepValue(9, 5, 1, 10)).toBe(10);
  });
});

describe('MultiSelectSwatchGrid', () => {
  test('toggles swatches with aria-checked and helpers agree', () => {
    const onChange = vi.fn();
    renderUi(() => (
      <MultiSelectSwatchGrid
        label="Colors"
        palette={['ff0000', '00ff00']}
        value={['ff0000']}
        onChange={onChange}
      />
    ));
    const red = screen.getByRole('checkbox', { name: 'Color ff0000' });
    expect(red).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Color 00ff00' }));
    expect(onChange).toHaveBeenCalledWith(['ff0000', '00ff00']);
    expect(toggleSwatch(['a'], 'a')).toEqual([]);
    expect(arraysEqualAsSets(['a', 'b'], ['b', 'a'])).toBe(true);
  });
});

describe('SocialSignInButton', () => {
  test('renders the provider label, brand glyph, and blocks when loading', () => {
    const onClick = vi.fn();
    renderUi(() => (
      <>
        <SocialSignInButton provider="google" onClick={onClick} />
        <SocialSignInButton
          provider="google"
          action="signIn"
          loading
          onClick={onClick}
        />
      </>
    ));
    const btn = screen.getByRole('button', { name: 'Continue with Google' });
    expect(btn.querySelector('svg')).not.toBeNull();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    const busy = screen.getByRole('button', { name: 'Sign in with Google' });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(busy);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('CopyToClipboardField', () => {
  test('copies via the injected sink and flips to the copied label', async () => {
    const copy = vi.fn(async (_text: string) => {});
    const { clock } = renderUi(() => (
      <CopyToClipboardField
        value="ABC-123"
        copy={copy}
        label="Invite code"
        copiedLabel={asLocalized('Copied!')}
      />
    ));
    const trigger = screen.getByRole('button', { name: 'Copy to clipboard' });
    expect(trigger).toHaveTextContent('ABC-123');
    fireEvent.click(trigger);
    await Promise.resolve();
    expect(copy).toHaveBeenCalledWith('ABC-123');
    expect(
      await screen.findByRole('button', { name: 'Copied!' })
    ).toHaveAttribute('data-copied', 'true');
    clock.advance(DEFAULT_COPIED_RESET_MS);
    expect(trigger).toHaveAttribute('data-copied', 'false');
  });
});

describe('FormActionsFooter', () => {
  test('submit runs the operation with success feedback; cancel fires', async () => {
    const operation = vi.fn(async () => {});
    const onCancel = vi.fn();
    const { clock } = renderUi(() => (
      <FormActionsFooter
        submit={{
          label: 'Save',
          loadingLabel: 'Saving…',
          successLabel: 'Saved',
          operation,
          successHoldMs: 300,
        }}
        cancel={{ label: 'Cancel', onClick: onCancel }}
      />
    ));
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toHaveAttribute('type', 'submit');
    fireEvent.click(save);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Saved' })).toBeVisible();
    clock.advance(300);
    expect(await screen.findByRole('button', { name: 'Save' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
