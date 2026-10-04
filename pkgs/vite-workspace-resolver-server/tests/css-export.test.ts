import { expect, test } from 'bun:test';
import { expandExportTargets } from '@pkgs/vite-workspace-resolver-server/vite-workspace-resolver';

// regression: flat-package-css-export-specificity
test('asset exports take precedence over the general flat source wildcard', () => {
  expect(
    expandExportTargets(
      {
        './*': ['./src/*.ts', './src/*.tsx'],
        './*.css': './src/*.css',
      },
      './tokens.css'
    )
  ).toEqual(['./src/tokens.css']);
  expect(
    expandExportTargets(
      {
        './*': './src/*.ts',
        './theme/*': './theme/*.css',
      },
      './theme/dark'
    )
  ).toEqual(['./theme/dark.css']);
});
