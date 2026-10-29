/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { buttonFaceName } from '@pkgs/ui-root-client-ts/button-face';
import { Chip } from '@pkgs/ui-root-client-ts/chip';
import { ChipGroup, toggleChipKey } from '@pkgs/ui-root-client-ts/chip-group';
import {
  NumberStepper,
  stepperBound,
} from '@pkgs/ui-root-client-ts/number-stepper';
import { SegmentedControl } from '@pkgs/ui-root-client-ts/segmented-control';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

const GAMES = [
  { key: 'chess', label: 'Chess' },
  { key: 'go', label: 'Go' },
  { key: 'words', label: 'Words' },
] as const;

type Game = (typeof GAMES)[number]['key'];

describe('Button faces follow the brief', () => {
  test('secondary (neutral solid) is the outline face and disables as one', () => {
    expect(buttonFaceName({ intent: 'neutral' })).toBe('neutral');
    expect(buttonFaceName({ intent: 'neutral', disabled: true })).toBe(
      'disabled-outline'
    );
    expect(
      buttonFaceName({ intent: 'neutral', variant: 'outline', disabled: true })
    ).toBe('disabled-outline');
    expect(buttonFaceName({ disabled: true })).toBe('disabled');
    expect(buttonFaceName({ intent: 'danger', variant: 'outline' })).toBe(
      'danger-outline'
    );
  });

  test('every size keeps a 44px hit area through `hitTarget`', () => {
    renderUi(() => <Button title="Small" size="sm" />);
    const el = screen.getByRole('button', { name: 'Small' });
    expect(el.className).toMatch(/\bhitTarget\b/);
    // The pill must not clip the hit area it grows.
    expect(el.className).not.toMatch(/\boverflow-hidden\b/);
  });
});

describe('Chip', () => {
  test('a 32px chip takes the 44px hit area and can leave the tab order', () => {
    renderUi(() => <Chip label="Rated" tabStop={false} />);
    const el = screen.getByRole('button', { name: 'Rated' });
    expect(el.className).toMatch(/\bhitTarget\b/);
    expect(el).toHaveAttribute('aria-pressed', 'false');
    expect(el).toHaveAttribute('tabindex', '-1');
  });
});

describe('ChipGroup multiple selection', () => {
  test('toggles chips with aria-pressed and reports keys in option order', () => {
    renderUi(() => {
      const [picked, setPicked] = createSignal<readonly Game[]>(['words']);
      return (
        <ChipGroup<Game>
          selection="multiple"
          label="Games"
          options={GAMES}
          selected={picked()}
          onSelect={setPicked}
        />
      );
    });
    const group = screen.getByRole('group', { name: 'Games' });
    expect(group.closest('[data-component="ChipGroup"]')).toHaveAttribute(
      'data-selection',
      'multiple'
    );
    const chess = screen.getByRole('button', { name: 'Chess' });
    const words = screen.getByRole('button', { name: 'Words' });
    expect(chess).toHaveAttribute('aria-pressed', 'false');
    expect(words).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(chess);
    expect(chess).toHaveAttribute('aria-pressed', 'true');
    expect(words).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(words);
    expect(words).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('radio')).toBeNull();
  });

  test('toggleChipKey adds and removes in option order', () => {
    expect(toggleChipKey(GAMES, ['words'], 'chess')).toEqual([
      'chess',
      'words',
    ]);
    expect(toggleChipKey(GAMES, ['chess', 'words'], 'chess')).toEqual([
      'words',
    ]);
  });

  test('a disabled option ignores presses', () => {
    const onSelect = mock();
    renderUi(() => (
      <ChipGroup<Game>
        selection="multiple"
        aria-label="Games"
        options={GAMES.map((game) => ({
          ...game,
          disabled: game.key === 'go',
        }))}
        selected={[]}
        onSelect={onSelect}
      />
    ));
    const later = screen.getByRole('button', { name: 'Go' });
    expect(later).toBeDisabled();
    fireEvent.click(later);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('ChipGroup single selection', () => {
  test('is one tab stop; arrows move and choose, wrapping', async () => {
    const user = userEvent.setup();
    renderUi(() => {
      const [game, setGame] = createSignal<Game>('go');
      return (
        <ChipGroup<Game>
          label="Game"
          options={GAMES}
          selected={game()}
          onSelect={setGame}
        />
      );
    });
    expect(screen.getByRole('radiogroup', { name: 'Game' })).toBeVisible();
    const go = screen.getByRole('radio', { name: 'Go' });
    expect(go).not.toHaveAttribute('tabindex');
    expect(screen.getByRole('radio', { name: 'Chess' })).toHaveAttribute(
      'tabindex',
      '-1'
    );
    await user.tab();
    expect(document.activeElement).toBe(go);
    await user.keyboard('{ArrowRight}');
    const words = screen.getByRole('radio', { name: 'Words' });
    expect(document.activeElement).toBe(words);
    expect(words).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Chess' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  test('pressing the chosen chip again does not re-select it', () => {
    const onSelect = mock();
    renderUi(() => (
      <ChipGroup<Game>
        aria-label="Game"
        options={GAMES}
        selected="chess"
        onSelect={onSelect}
      />
    ));
    fireEvent.click(screen.getByRole('radio', { name: 'Chess' }));
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: 'Go' }));
    expect(onSelect).toHaveBeenCalledWith('go');
  });
});

describe('SegmentedControl keyboard', () => {
  test('one tab stop; arrow keys move the selection', async () => {
    const user = userEvent.setup();
    renderUi(() => {
      const [view, setView] = createSignal('day');
      return (
        <SegmentedControl
          aria-label="View"
          segments={[
            { key: 'day', label: 'Day' },
            { key: 'week', label: 'Week' },
          ]}
          selected={view()}
          onSelect={setView}
        />
      );
    });
    const day = screen.getByRole('radio', { name: 'Day' });
    const week = screen.getByRole('radio', { name: 'Week' });
    expect(week).toHaveAttribute('tabindex', '-1');
    expect(week.className).toMatch(/\bhitTarget\b/);
    await user.tab();
    expect(document.activeElement).toBe(day);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(week);
    expect(week).toHaveAttribute('aria-checked', 'true');
    expect(week).toHaveAttribute('tabindex', '0');
  });
});

describe('NumberStepper bounds', () => {
  test('disables the control at a bound and announces why', () => {
    renderUi(() => {
      const [players, setPlayers] = createSignal(3);
      return (
        <NumberStepper
          label="Players"
          value={players()}
          onChange={setPlayers}
          min={2}
          max={4}
        />
      );
    });
    const spin = screen.getByRole('spinbutton', { name: 'Players' });
    const dec = screen.getByRole('button', { name: 'Decrease Players' });
    const inc = screen.getByRole('button', { name: 'Increase Players' });
    expect(spin.className).toMatch(/\btextStat\b/);
    expect(spin).not.toHaveAttribute('aria-describedby');
    expect(dec).toBeEnabled();

    fireEvent.click(dec);
    expect(spin).toHaveAttribute('aria-valuenow', '2');
    expect(dec).toBeDisabled();
    expect(inc).toBeEnabled();
    expect(dec).toHaveAccessibleDescription('Players is at its minimum, 2');
    expect(spin).toHaveAccessibleDescription('Players is at its minimum, 2');
    expect(inc).not.toHaveAttribute('aria-describedby');

    fireEvent.click(inc);
    fireEvent.click(inc);
    expect(spin).toHaveAttribute('aria-valuenow', '4');
    expect(inc).toBeDisabled();
    expect(inc).toHaveAccessibleDescription('Players is at its maximum, 4');
    expect(dec).not.toHaveAttribute('aria-describedby');
  });

  test('Home and End jump to the bounds; a disabled stepper ignores keys', () => {
    const onChange = mock();
    renderUi(() => (
      <>
        <NumberStepper
          label="Rows"
          value={5}
          onChange={onChange}
          min={2}
          max={9}
        />
        <NumberStepper
          label="Columns"
          value={5}
          onChange={onChange}
          min={2}
          max={9}
          disabled
        />
      </>
    ));
    const rows = screen.getByRole('spinbutton', { name: 'Rows' });
    fireEvent.keyDown(rows, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(rows, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(9);
    onChange.mockClear();
    const columns = screen.getByRole('spinbutton', { name: 'Columns' });
    fireEvent.keyDown(columns, { key: 'ArrowUp' });
    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Increase Columns' })
    ).toBeDisabled();
    // A disabled stepper has no bound to explain.
    expect(columns).not.toHaveAttribute('aria-describedby');
  });

  test('stepperBound names the bound the value sits on', () => {
    expect(stepperBound(2, 2, 8)).toBe('min');
    expect(stepperBound(8, 2, 8)).toBe('max');
    expect(stepperBound(5, 2, 8)).toBeNull();
  });
});
