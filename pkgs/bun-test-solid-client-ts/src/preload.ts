// @io-wall-ok — bun:test preload; Solid + happy-dom + jest-dom matchers
/**
 * The one `bun test` preload for Solid / DOM tests:
 *
 *   bun test --conditions=browser --conditions=development \
 *     --preload @pkgs/bun-test-solid-client-ts/preload
 *
 * `./register` compiles Solid `.tsx` and installs happy-dom; on top of that
 * this pins one Lingui runtime per process, adds the jest-dom matchers
 * (types: `@pkgs/bun-test-solid-client-ts/jest-dom`) and unmounts rendered trees after
 * every test.
 */

import './register';
import { afterEach, expect, mock } from 'bun:test';
import * as linguiCore from '@lingui/core';

// `import.meta.env` is `process.env` under Bun: keep `@pkgs/ui` DOM identifiers
// (`data-component` / `data-screen`) on, as Vite dev and test builds do.
process.env['VITE_TEST_HOOKS'] = process.env['VITE_TEST_HOOKS'] ?? '1';

// Pin Lingui to this process's singleton. bun's content-addressed install
// can resolve `@lingui/core` to distinct copies per workspace; the instance
// activated here must be the one every compiled macro reads.
void mock.module('@lingui/core', () => linguiCore);
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

// A browser reaches a microtask checkpoint, where Solid applies queued writes,
// after every event it delivers. A synthetic dispatch returns to the test
// synchronously instead, so apply them at the same point: once the outermost
// dispatch has returned.
const { flush } = await import('solid-js');
let dispatchDepth = 0;
/** Every class that implements dispatch itself: the base and each element that adds a default action. */
function dispatchingPrototypes(): Set<object> {
  const found = new Set<object>();
  const visit = (start: unknown): void => {
    for (
      let prototype: unknown = start;
      typeof prototype === 'object' && prototype !== null;
      prototype = Object.getPrototypeOf(prototype)
    ) {
      if (Object.hasOwn(prototype, 'dispatchEvent')) found.add(prototype);
    }
  };
  for (const name of Object.getOwnPropertyNames(window)) {
    const value: unknown = Reflect.get(window, name);
    if (typeof value === 'function') visit(value.prototype);
  }
  visit(window);
  return found;
}
for (const prototype of dispatchingPrototypes()) {
  const dispatch: unknown = Reflect.get(prototype, 'dispatchEvent');
  if (typeof dispatch !== 'function') continue;
  Reflect.set(
    prototype,
    'dispatchEvent',
    function dispatchEvent(this: EventTarget, event: Event): unknown {
      dispatchDepth += 1;
      try {
        return Reflect.apply(dispatch, this, [event]);
      } finally {
        dispatchDepth -= 1;
        if (dispatchDepth === 0) flush();
      }
    }
  );
}

afterEach(() => {
  cleanup();
});
