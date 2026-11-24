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
import { setHarnessTaskCheckpoint } from '@pkgs/clock-shared-ts/harness-clock';

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

// A browser drains its microtasks, where Solid applies queued writes, after
// every event and timer callback it delivers. Synthetic events and virtual
// timers return to the test synchronously instead, so apply the writes at
// the same points: once the outermost dispatch or a fired timer has returned.
// Solid already drains when it runs from a microtask or owns the current
// scope, and it refuses a nested drain there.
let draining = false;
const nativeQueueMicrotask = globalThis.queueMicrotask;
globalThis.queueMicrotask = (callback) => {
  nativeQueueMicrotask(() => {
    draining = true;
    try {
      callback();
    } finally {
      draining = false;
    }
  });
};
const { flush, getOwner } = await import('solid-js');
const SOLID_FRAME = /[\\/]@solidjs[\\/]signals[\\/]/;
/**
 * An effect callback that dispatches (`element.focus()`) runs unowned inside
 * a drain Solid started itself: `render`, or a `flush()` the test called. No
 * public state tells that apart from a dispatch by the test, so read it off
 * the call stack. Solid applies such a callback's writes in the same drain.
 */
function calledBySolid(): boolean {
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = 64;
  try {
    return SOLID_FRAME.test(new Error('probe').stack ?? '');
  } finally {
    Error.stackTraceLimit = limit;
  }
}
function taskCheckpoint(): void {
  if (draining || getOwner() !== null || calledBySolid()) return;
  draining = true;
  try {
    flush();
  } finally {
    draining = false;
  }
}
setHarnessTaskCheckpoint(taskCheckpoint);
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
      // A browser exposes the event it is delivering as `window.event`, and
      // Solid reads it to tell a handler from the effect callback that
      // dispatched to it (`element.focus()`). happy-dom leaves it unset.
      const outer: unknown = Reflect.get(globalThis, 'event');
      Reflect.set(globalThis, 'event', event);
      dispatchDepth += 1;
      try {
        return Reflect.apply(dispatch, this, [event]);
      } finally {
        dispatchDepth -= 1;
        Reflect.set(globalThis, 'event', outer);
        if (dispatchDepth === 0) taskCheckpoint();
      }
    }
  );
}

afterEach(() => {
  cleanup();
});
