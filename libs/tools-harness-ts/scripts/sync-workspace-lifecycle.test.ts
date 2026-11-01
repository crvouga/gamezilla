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

  test('T3 waits for strict setup and cleans up only its settled worktree', () => {
    const file = files.find((entry) => entry.path === 't3.json');
    expect(file).toBeDefined();
    const config = JSON.parse(file!.content) as {
      defaultThreadEnvMode: string;
      scripts: {
        command: string;
        async?: boolean;
        runOnWorktreeCreate?: boolean;
        runOnSettle?: boolean;
        previewUrl?: string;
      }[];
    };
    expect(config.defaultThreadEnvMode).toBe('worktree');
    const setup = config.scripts.filter((script) => script.runOnWorktreeCreate);
    expect(setup).toHaveLength(1);
    expect(setup[0]?.command).toBe(
      './libs/tools-harness-ts/workspace/setup.sh'
    );
    expect(setup[0]?.async).toBe(false);
    expect(config.scripts.filter((script) => script.runOnSettle)).toEqual([
      expect.objectContaining({ command: hookCommand('teardown') }),
    ]);
    expect(
      config.scripts.some((script) => script.command === hookCommand('run'))
    ).toBe(true);
    expect(
      config.scripts.every((script) => script.previewUrl === undefined)
    ).toBe(true);
  });

  test('every orchestrator runs the same script for every hook', () => {
    for (const file of files) {
      if (file.path === 't3.json') continue;
      if (file.path === '.vscode/tasks.json') {
        const config = JSON.parse(file.content) as {
          tasks: { args: string[] }[];
        };
        expect(config.tasks.map((task) => task.args)).toEqual(
          HOOKS.map((hook) => [hookCommand(hook)])
        );
        continue;
      }
      if (file.path === '.cursor/worktrees.json') {
        expect(JSON.parse(file.content)).toEqual({
          'setup-worktree-unix': [hookCommand('setup')],
        });
        continue;
      }
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
