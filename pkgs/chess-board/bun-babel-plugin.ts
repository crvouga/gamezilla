/**
 * Bun plugin: Expo + Lingui macros for chess-board RNTL tests.
 * onLoad is synchronous so CJS `require()` of transformed RN still works.
 */

import { installRnPlatformResolve } from '@pkgs/ui-testing-rntl/bun-rn-platform-resolve';
import {
  babelTransformRnTestFile,
  bunMediaAssetModule,
  MEDIA_ASSET_FILTER,
  RN_NODE_MODULE_FILTER,
  WORKSPACE_TSX_FILTER,
  workspaceRnTestOnLoad,
} from '@pkgs/ui-testing-rntl/bun-rn-transform';
import { plugin } from 'bun';

const configFile = require.resolve('./babel.test.config.cjs');

function transform(path: string): { contents: string; loader: 'js' } {
  return babelTransformRnTestFile({
    filePath: path,
    configFile,
    keepEsm: true,
  });
}

plugin({
  name: 'chess-board-test-babel',
  setup(build) {
    installRnPlatformResolve(build);
    build.onLoad({ filter: WORKSPACE_TSX_FILTER }, (args) =>
      workspaceRnTestOnLoad(args.path, transform)
    );
    build.onLoad({ filter: MEDIA_ASSET_FILTER }, () => bunMediaAssetModule());
    build.onLoad({ filter: RN_NODE_MODULE_FILTER }, (args) =>
      babelTransformRnTestFile({
        filePath: args.path,
        configFile,
        keepEsm: false,
      })
    );
  },
});
