/**
 * `attr:value` is dom-expressions' escape hatch back to `setAttribute`, which
 * is what the screens' fields need: Solid would otherwise set `input.value` as
 * a property, and the rendered HTML would lose the address a human typed
 * after a failed step — the headless walkers and the no-JS view both read the
 * markup, not the live DOM. `TextInput` forwards it to its `<input>`.
 *
 * A module (imported by `form-field.tsx`), not an ambient `.d.ts`, so every
 * package that compiles these screens sees the augmentation too.
 */

import 'solid-js';

declare module 'solid-js' {
  namespace JSX {
    interface ExplicitAttributes {
      value: string;
    }
  }
}

export {};
