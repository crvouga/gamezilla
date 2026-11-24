import { defineConfig } from '@lingui/conf';
import rootConfig, { LINGUI_JSX_MACRO_PACKAGES } from './lingui.config';

const RUNTIME = '@pkgs/lingui-solid-client-ts/runtime';

/**
 * Solid-flavoured Lingui config for Vite builds and `bun test` (`@pkgs/bun-test-solid-client-ts`).
 *
 * Same catalogs as the root config; only the macro output differs
 * (`jsxRuntime: 'solid'` wraps `<Trans>` element children as components and
 * `runtimeConfigModule` points at the Solid runtime in
 * `@pkgs/lingui-solid-client-ts`).
 */
export default defineConfig({
  ...rootConfig,
  macro: {
    ...rootConfig.macro,
    jsxPackage: [...LINGUI_JSX_MACRO_PACKAGES],
    jsxRuntime: 'solid',
  },
  runtimeConfigModule: {
    Trans: [RUNTIME, 'Trans'],
    useLingui: [RUNTIME, 'useLingui'],
  },
});
