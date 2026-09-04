/**
 * Bun plugin: Expo + Lingui macros for in-process RNTL product tests.
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

process.env['EXPO_PUBLIC_E2E'] = process.env['EXPO_PUBLIC_E2E'] ?? '1';
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';

const configFile = require.resolve('./babel.test.config.cjs');

/** Each bun `@lingui/core` copy must activate; macros compile to `i18n._`. */
const LINGUI_ACTIVATE = `import { i18n as __gzLingui } from "@lingui/core";
if (__gzLingui.locale == null || __gzLingui.locale === "") {
  __gzLingui.loadAndActivate({ locale: "en", messages: {} });
}
`;

function transform(path: string): { contents: string; loader: 'js' } {
  const result = babelTransformRnTestFile({
    filePath: path,
    configFile,
    keepEsm: true,
  });
  if (!result.contents.includes('@lingui/core')) return result;
  return { ...result, contents: `${LINGUI_ACTIVATE}${result.contents}` };
}

plugin({
  name: 'product-test-babel',
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
