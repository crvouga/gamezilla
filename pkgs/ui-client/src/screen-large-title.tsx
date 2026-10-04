/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { dataAttrs } from '@pkgs/ui-shared/component-id';
import type { JSX } from 'solid-js';
import { useScreenTitleContext } from './screen-title-context';

export type ScreenLargeTitleProps = {
  label?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
};

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
