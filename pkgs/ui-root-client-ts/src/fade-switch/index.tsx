/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';

export type FadeSwitchProps = {
  stateKey: string;
  children: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `FadeSwitch` -- instant swap when `stateKey` changes (no animated fade; the
 * key is kept for API parity and as a `data-state-key` hook for spec).
 */
export function FadeSwitch(props: FadeSwitchProps): JSX.Element {
  return (
    <div
      class="box flex-1 min-h-0"
      {...dataAttrs({
        component: 'FadeSwitch',
        'state-key': props.stateKey,
        ...props.dataSet,
      })}
    >
      {props.children}
    </div>
  );
}
