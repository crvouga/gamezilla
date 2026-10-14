import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { cssPx } from '@pkgs/ui-root-shared/css-px';
import type { JSX } from 'solid-js';
import styles from './screen-layouts.module.css';
import { SCREEN_MAX_WIDTH, type ScreenMeasure } from './screen-measure';

/** Shared measure and section rhythm for routed screen bodies and footers. */
export function ScreenColumn(props: {
  children: JSX.Element;
  width?: ScreenMeasure | 'full' | undefined;
}): JSX.Element {
  return (
    <div
      class={styles['column']}
      style={{
        'max-width':
          props.width === 'full'
            ? '100%'
            : cssPx(SCREEN_MAX_WIDTH[props.width ?? 'reading']),
      }}
      {...dataAttrs({ component: 'ScreenColumn' })}
    >
      {props.children}
    </div>
  );
}
