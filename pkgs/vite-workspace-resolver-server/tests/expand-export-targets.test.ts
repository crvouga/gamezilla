import { describe, expect, test } from 'bun:test';
import { expandExportTargets } from '@pkgs/vite-workspace-resolver-server/vite-workspace-resolver';

const EXPORTS = {
  '.': './src/index.ts',
  './solid': './src/solid/index.tsx',
  './client/*': ['./src/client/*.ts', './src/client/*.tsx'],
  './*': ['./src/*.ts', './src/*.tsx', './src/*/index.ts'],
};

describe('expandExportTargets', () => {
  test('exact keys win over wildcards', () => {
    expect(expandExportTargets(EXPORTS, './solid')).toEqual([
      './src/solid/index.tsx',
    ]);
    expect(expandExportTargets(EXPORTS, '.')).toEqual(['./src/index.ts']);
  });

  test('expands the wildcard into every fallback target', () => {
    expect(expandExportTargets(EXPORTS, './kv-context')).toEqual([
      './src/kv-context.ts',
      './src/kv-context.tsx',
      './src/kv-context/index.ts',
    ]);
  });

  test('longer prefixes match before the catch-all', () => {
    expect(expandExportTargets(EXPORTS, './client/tts-context')).toEqual([
      './src/client/tts-context.ts',
      './src/client/tts-context.tsx',
    ]);
  });

  test('returns nothing for unmatched subpaths', () => {
    expect(expandExportTargets({ './a': './src/a.ts' }, './b')).toEqual([]);
  });
});
