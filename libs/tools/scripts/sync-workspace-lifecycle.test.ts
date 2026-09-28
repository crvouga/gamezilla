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
      const config = JSON.parse(file.content) as Record<string, string[]>;
      for (const hook of HOOKS)
        expect(config[hook]).toEqual([hookCommand(hook)]);
    }
  });
});
