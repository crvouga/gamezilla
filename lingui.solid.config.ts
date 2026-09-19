import { defineConfig } from '@lingui/solid/config';
import rootConfig, { LINGUI_JSX_MACRO_PACKAGES } from './lingui.config';

/**
 * Solid-flavoured Lingui config for Vite builds and `bun test` (`@pkgs/bun-test-solid`).
 *
 * Same catalogs as the root config; only the macro output differs
 * (`jsxRuntime: 'solid'` wraps `<Trans>` element children as components and
 * `runtimeConfigModule` points at `@lingui/solid`).
 */
export default defineConfig({
  ...rootConfig,
  macro: {
    ...rootConfig.macro,
    jsxPackage: [...LINGUI_JSX_MACRO_PACKAGES],
    jsxRuntime: 'solid',
  },
});
