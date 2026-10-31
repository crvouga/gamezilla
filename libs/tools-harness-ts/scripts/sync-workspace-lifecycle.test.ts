import { describe, expect, test } from 'bun:test';

import {
  HOOKS,
  hookCommand,
  ORCHESTRATORS,
  renderConfigs,
} from './sync-workspace-lifecycle';

describe('renderConfigs', () => {
  const files = renderConfigs();

  test('emits one config per orchestrator', () => {
    expect(files.map((file) => file.path)).toEqual(
      ORCHESTRATORS.map((orchestrator) => orchestrator.configPath)
    );
  });

  test('every orchestrator runs the same script for every hook', () => {
    for (const file of files) {
      if (file.path.endsWith('.toml')) {
        const config = Bun.TOML.parse(file.content) as {
          scripts: { run: string; archive: string; run_mode: string };
        };
        expect(config.scripts.run).toBe(hookCommand('run'));
        expect(config.scripts.archive).toBe(hookCommand('teardown'));
        expect(config.scripts.run_mode).toBe('nonconcurrent');
        continue;
      }
      if (file.path === '.emdash.json') {
        const config = JSON.parse(file.content) as {
          scripts: Record<string, string>;
        };
        expect(config.scripts).toEqual({
          run: hookCommand('run'),
          teardown: hookCommand('teardown'),
        });
        continue;
      }
      if (file.path === '.cmux/cmux.json') {
        const { commands } = JSON.parse(file.content) as {
          commands: { command: string }[];
        };
        expect(commands.map((entry) => entry.command)).toEqual(
          HOOKS.map(
            (hook) =>
              `cd "$(git rev-parse --show-toplevel)" && ${hookCommand(hook)}`
          )
        );
        continue;
      }
      const config = JSON.parse(file.content) as Record<string, string[]>;
      for (const hook of HOOKS)
        expect(config[hook]).toEqual([hookCommand(hook)]);
    }
  });
});
