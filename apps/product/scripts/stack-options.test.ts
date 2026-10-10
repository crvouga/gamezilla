import { describe, expect, test } from 'bun:test';

import { parseStackOptions } from './stack-options';

describe('localhost stack options', () => {
  test('the web port stays unset unless asked', () => {
    const options = parseStackOptions(['--instance', 'alpha']);
    expect(options.webPort).toBeNull();
    expect(options.withWeb).toBe(true);
    expect(options.apiNodes).toBe(2);
    expect(options.populationWorkers).toBe(1);
  });

  test('multiple local Population Workers have a bounded replica count', () => {
    expect(
      parseStackOptions(['--population-workers', '3']).populationWorkers
    ).toBe(3);
    expect(
      parseStackOptions(['--population-workers', '0']).populationWorkers
    ).toBe(0);
    for (const count of ['-1', '9', '1.5', 'NaN'])
      expect(() => parseStackOptions(['--population-workers', count])).toThrow(
        'between 0 and 8'
      );
  });

  test('a workspace pins the web listener with --web-port', () => {
    const options = parseStackOptions([
      '--instance',
      'alpha',
      '--web-port',
      '5264',
      '--api-nodes',
      '1',
    ]);
    expect(options.webPort).toBe(5264);
    expect(options.apiNodes).toBe(1);
  });

  test('--web-port is refused when the web app is off', () => {
    expect(() => parseStackOptions(['--no-web', '--web-port', '5264'])).toThrow(
      '--web-port requires the web app'
    );
  });

  test('--web-port must be a TCP port', () => {
    expect(() => parseStackOptions(['--web-port', 'nope'])).toThrow(
      "--web-port must be a TCP port (got 'nope')"
    );
  });
});
