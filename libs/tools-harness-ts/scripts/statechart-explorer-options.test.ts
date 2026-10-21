import { describe, expect, test } from 'bun:test';
import { statechartExplorerFlags } from './statechart-explorer-options';

describe('statechart explorer address', () => {
  test('uses an explicit loopback address by default', () => {
    expect(statechartExplorerFlags([])).toEqual(['--host', '127.0.0.1']);
    expect(statechartExplorerFlags(['--port', '5190'])).toEqual([
      '--host',
      '127.0.0.1',
      '--port',
      '5190',
    ]);
  });

  test('preserves an explicit host', () => {
    expect(statechartExplorerFlags(['--host', '::1'])).toEqual([
      '--host',
      '::1',
    ]);
    expect(statechartExplorerFlags(['--host=0.0.0.0'])).toEqual([
      '--host=0.0.0.0',
    ]);
  });
});
