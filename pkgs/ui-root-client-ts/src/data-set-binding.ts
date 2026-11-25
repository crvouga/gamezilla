/**
 * Extra `data-*` attributes on a layout host or a `Pressable`: state a test
 * or a stylesheet reads off the element (`data-inbox-state="waiting"`).
 * Design-system internal.
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { createRenderEffect, onCleanup, untrack } from 'solid-js';

export type DataSetProps = {
  /**
   * More `data-*` attributes, keyed without the prefix
   * (`{ 'inbox-state': 'waiting' }`). The test id is `testId`.
   */
  dataSet?: ComponentDataSet | undefined;
};

const NO_DATA_SET = (): void => undefined;

function attributesOf(
  set: ComponentDataSet | undefined
): ReadonlyMap<string, string> {
  const attributes = new Map<string, string>();
  if (set === undefined) return attributes;
  for (const [key, value] of Object.entries(set)) {
    attributes.set(`data-${key}`, value);
  }
  return attributes;
}

/**
 * A `ref` callback that writes `host.dataSet` onto the host's element,
 * following it as it changes. Call in the component body
 * (`ref={bindDataSet(props)}`): a ref callback owns nothing, so the effect
 * that follows the set is created here. A host written without `dataSet`
 * pays nothing.
 */
export function bindDataSet(
  host: DataSetProps
): (element: HTMLElement) => void {
  // Whether a host was written with `dataSet` is its shape, read once.
  if (!untrack(() => 'dataSet' in host)) return NO_DATA_SET;
  let element: HTMLElement | undefined;
  let wanted: ReadonlyMap<string, string> = new Map();
  let written: ReadonlyMap<string, string> = new Map();
  const sync = (): void => {
    const target = element;
    if (target === undefined) return;
    for (const name of written.keys()) {
      if (!wanted.has(name)) target.removeAttribute(name);
    }
    for (const [name, value] of wanted) target.setAttribute(name, value);
    written = wanted;
  };
  createRenderEffect(() => {
    wanted = attributesOf(host.dataSet);
    return wanted;
  }, sync);
  onCleanup(() => {
    wanted = new Map();
    sync();
  });
  return (target) => {
    element = target;
    sync();
  };
}
