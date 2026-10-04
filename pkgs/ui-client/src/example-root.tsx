/** @jsxImportSource solid-js */
/**
 * Root layout for UI explorer component examples.
 *
 * Owns shared section spacing (`gap-4`) and omits edge padding — ScreenBase /
 * ExplorerDetail already inset the body. Pass `class` to override gap or add
 * layout extras.
 *
 * Examples never provide their own clock: the hosting app supplies
 * `ClockProvider` (wall at the process root, harness in tests).
 */

import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { dataAttrs } from '@pkgs/ui-shared/component-id';

export type ExampleRootProps = {
  children: JSX.Element;
  /** Merged over the default `gap-4`. */
  class?: string | undefined;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function ExampleRoot(props: ExampleRootProps): JSX.Element {
  return (
    <div
      class="box gap-4"
      classList={{ [String(props.class)]: true }}
      {...dataAttrs({ component: 'ExampleRoot', ...props.dataSet })}
    >
      {props.children}
    </div>
  );
}
