/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { useScreenTitleContext } from '../screen-title-context/index';

export type ScreenLargeTitleProps = {
  label?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * Page heading sourced from an explicit label or the enclosing ScreenBase title context. Requires one of those sources; use once at the top of the screen content.
 */
export function ScreenLargeTitle(props: ScreenLargeTitleProps): JSX.Element {
  const ctx = useScreenTitleContext();
  const resolved = (): JSX.Element => {
    const value = props.label ?? ctx?.title();
    if (value === undefined || value === null) {
      throw new Error(
        'ScreenLargeTitle requires `label` or ScreenBase `largeTitle`'
      );
    }
    return value;
  };
  return (
    <div
      class="box pt-3 mb-4"
      {...dataAttrs({ component: 'ScreenLargeTitle', ...props.dataSet })}
    >
      <h1 class="text textTitle">{resolved()}</h1>
    </div>
  );
}
