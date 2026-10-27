import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AGENT_SKILLS,
  BREW_ENV,
  brewUpgradeCommand,
  graphifyInstallCommand,
  miseInstallCommand,
  miseUpgradeCommand,
  skillsUpdateCommand,
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

// regression: mise-infisical-asset-pinned-to-one-platform
test('the Infisical CLI names its release asset per platform', () => {
  const { tools } = Bun.TOML.parse(
    readFileSync(join(import.meta.dirname, '../../../mise.toml'), 'utf8')
  ) as {
    tools: {
      infisical: {
        asset_pattern?: string;
        platforms?: Record<string, { asset_pattern: string }>;
      };
    };
  };
  const { infisical } = tools;
  expect(infisical.asset_pattern).toBeUndefined();
  expect(
    Object.fromEntries(
      Object.entries(infisical.platforms ?? {}).map(([platform, entry]) => [
        platform,
        entry.asset_pattern,
      ])
    )
  ).toEqual({
    'macos-arm64': 'cli_{{ version }}_darwin_arm64.tar.gz',
    'macos-x64': 'cli_{{ version }}_darwin_amd64.tar.gz',
    'linux-arm64': 'cli_{{ version }}_linux_arm64.tar.gz',
    'linux-x64': 'cli_{{ version }}_linux_amd64.tar.gz',
    'windows-x64': 'cli_{{ version }}_windows_amd64.zip',
    'windows-arm64': 'cli_{{ version }}_windows_arm64.zip',
  });
});

test('a tool bump refreshes the agent skills built from it', () => {
  expect(graphifyInstallCommand().join(' ')).toBe(
    'mise exec -- bun run libs/tools-harness-ts/scripts/graphify-install.ts'
  );
  expect(skillsUpdateCommand(AGENT_SKILLS).join(' ')).toBe(
    'mise exec -- bunx skills update ast-grep ast-grep-outline -p -y'
  );
});
