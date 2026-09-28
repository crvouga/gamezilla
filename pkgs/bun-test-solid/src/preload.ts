// @io-wall-ok — bun:test preload; Solid + happy-dom + jest-dom matchers
/**
 * The one `bun test` preload for Solid / DOM tests:
 *
 *   bun test --conditions=browser --conditions=development \
 *     --preload @pkgs/bun-test-solid/preload
 *
 * `./register` compiles Solid `.tsx` and installs happy-dom; on top of that
 * this pins one Lingui runtime per process, adds the jest-dom matchers
 * (types: `@pkgs/bun-test-solid/jest-dom`) and unmounts rendered trees after
 * every test.
 */

import './register';
import { afterEach, expect, mock } from 'bun:test';
import * as linguiCore from '@lingui/core';
import * as linguiSolid from '@lingui/solid';

// `import.meta.env` is `process.env` under Bun: keep `@pkgs/ui` DOM identifiers
// (`data-component` / `data-screen`) on, as Vite dev and test builds do.
process.env['VITE_TEST_HOOKS'] = process.env['VITE_TEST_HOOKS'] ?? '1';

// Pin Lingui to this process's singletons. bun's content-addressed install
// can resolve `@lingui/core` / `@lingui/solid` to distinct copies per
// workspace; the `I18nProvider` context must be the one `@pkgs/ui` reads.
void mock.module('@lingui/core', () => linguiCore);
void mock.module('@lingui/solid', () => linguiSolid);
linguiCore.i18n.loadAndActivate({ locale: 'en', messages: {} });

// Dynamic `import()`, not a static import: Bun evaluates CJS dependencies
// before this module's body, and `@testing-library/dom` binds `screen` to
// `document.body` at load — it must load after `./register` installed
// happy-dom. Not `require()` either: that picks the CJS build of
// `@solidjs/testing-library`, which loads a second copy of Solid.
// The matchers module is typed `export =`, so the namespace carries a synthetic
// `default` that is not a matcher — `expect.extend` must not receive it.
const { default: _default, ...matchers } = await import(
  '@testing-library/jest-dom/matchers'
);
const { cleanup } = await import('@solidjs/testing-library');

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
