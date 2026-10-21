/**
 * Extra `data-*` attributes on a layout host or a `Pressable`: state a test
 * or a stylesheet reads off the element (`data-inbox-state="waiting"`).
 * Design-system internal.
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { createRenderEffect, onCleanup } from 'solid-js';

export type DataSetProps = {
  /**
   * More `data-*` attributes, keyed without the prefix
   * (`{ 'inbox-state': 'waiting' }`). The test id is `testId`.
   */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * Write `host.dataSet` onto `element`, following it as it changes. Call
 * from the host's `ref`. A host written without `dataSet` pays nothing.
 */
export function bindDataSet(element: HTMLElement, host: DataSetProps): void {
  if (!('dataSet' in host)) return;
  createRenderEffect(() => {
    const set = host.dataSet;
    if (set === undefined) return;
    const names = Object.keys(set).map((key) => `data-${key}`);
    for (const [index, value] of Object.values(set).entries()) {
      const name = names[index];
      if (name !== undefined) element.setAttribute(name, value);
    }
    onCleanup(() => {
      for (const name of names) element.removeAttribute(name);
    });
  });
}
