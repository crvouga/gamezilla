import { expect, test } from 'bun:test';
import {
  BREW_ENV,
  brewUpgradeCommand,
  miseInstallCommand,
  miseUpgradeCommand,
} from './install-system';

// regression: install-system-tui-prompt
test('upgrades do not ask for confirmation the terminal UI cannot deliver', () => {
  expect(miseUpgradeCommand(['infisical', 'bun'])).toEqual([
    'mise',
    'upgrade',
    '--bump',
    '--yes',
    'infisical',
    'bun',
  ]);
  expect(miseInstallCommand()).toEqual(['mise', 'install', '--yes']);
  expect(brewUpgradeCommand('infisical')).toEqual([
    'brew',
    'upgrade',
    '--yes',
    'infisical',
  ]);
  expect(BREW_ENV['NONINTERACTIVE']).toBe('1');
  expect(BREW_ENV['HOMEBREW_NO_ASK']).toBe('1');
});
