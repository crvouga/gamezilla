import { describe, expect, test } from 'bun:test';
import { createRequire } from 'node:module';

const requireBabel = createRequire(import.meta.url);

type BabelApi = { cache: { using: (fn: () => string) => void } };

function loadClientBabelConfig(): { plugins: unknown[] } {
  const factory = requireBabel('../../babel.config.js') as (api: BabelApi) => {
    plugins: unknown[];
  };
  return factory({
    cache: {
      using: (fn) => {
        fn();
      },
    },
  });
}

describe('client babel Lingui plugin', () => {
  test('keeps message field in production so missing keys are not hashes', () => {
    const plugin = loadClientBabelConfig().plugins.find((entry) => {
      return (
        Array.isArray(entry) && entry[0] === '@lingui/babel-plugin-lingui-macro'
      );
    });
    expect(plugin).toEqual([
      '@lingui/babel-plugin-lingui-macro',
      { stripMessageField: false },
    ]);
  });
});
