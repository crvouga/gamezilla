/**
 * Bun plugin: Expo preset so bun:test can load React Native Flow entries.
 * onLoad is synchronous so CJS `require()` of transformed RN still works.
 */
import { plugin } from 'bun';
import { installRnPlatformResolve } from './src/bun-rn-platform-resolve';
import {
  babelTransformRnTestFile,
  bunMediaAssetModule,
  MEDIA_ASSET_FILTER,
  RN_NODE_MODULE_FILTER,
  WORKSPACE_TSX_FILTER,
  workspaceRnTestOnLoad,
} from './src/bun-rn-transform';

const configFile = require.resolve('./babel.test.config.cjs');

function transform(path: string): { contents: string; loader: 'js' } {
  return babelTransformRnTestFile({
    filePath: path,
    configFile,
    keepEsm: true,
  });
}

plugin({
  name: 'ui-testing-rn-babel',
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
