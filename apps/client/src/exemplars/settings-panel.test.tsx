/** @jsxImportSource solid-js */

import { renderWithI18n } from '@pkgs/vitest-solid/render';
import { fireEvent, screen } from '@solidjs/testing-library';
import { describe, expect, test, vi } from 'vitest';
import { type Settings, SettingsPanel } from './settings-panel';

const INITIAL: Settings = {
  displayName: 'Ada',
  soundEnabled: true,
  volume: 40,
  tags: ['blitz'],
};

describe('SettingsPanel', () => {
  test('save is disabled until the draft diverges from the initial settings', () => {
    const onSave = vi.fn();
    renderWithI18n(() => <SettingsPanel initial={INITIAL} onSave={onSave} />);
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    fireEvent.input(screen.getByLabelText('Display name'), {
      target: { value: 'Grace' },
    });
    expect(save).toBeEnabled();

    fireEvent.submit(save);
    expect(onSave).toHaveBeenCalledWith({ ...INITIAL, displayName: 'Grace' });
    // The caller receives a detached copy, not the live store proxy.
    expect(onSave.mock.calls[0]?.[0]).not.toBe(INITIAL);
  });

  test('edits nested arrays through produce and disables volume when sound is off', () => {
    renderWithI18n(() => <SettingsPanel initial={INITIAL} onSave={() => {}} />);

    const newTag = screen.getByLabelText('New tag');
    fireEvent.input(newTag, { target: { value: 'rapid' } });
    fireEvent.keyDown(newTag, { key: 'Enter' });
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      ['blitz×', 'rapid×']
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove blitz' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('listitem')).toHaveTextContent('rapid');

    const volume = screen.getByLabelText('Volume');
    expect(volume).toBeEnabled();
    fireEvent.click(screen.getByLabelText('Sound'));
    expect(volume).toBeDisabled();
  });
});
