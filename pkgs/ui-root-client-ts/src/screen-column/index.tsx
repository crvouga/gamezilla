import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import styles from '../screen-layouts.module.css';
import { SCREEN_MAX_WIDTH, type ScreenMeasure } from '../screen-measure';

/**
 * Shared measure and section rhythm for routed screen bodies and footers.
 * Centers the column whenever the frame is wider than its measure.
 */
export function ScreenColumn(props: {
  children: JSX.Element;
  width?: ScreenMeasure | undefined;
}): JSX.Element {
  return (
    <div
      class={`${styles['column']} mx-auto`}
      style={{ 'max-width': SCREEN_MAX_WIDTH[props.width ?? 'prose'] }}
      {...dataAttrs({ component: 'ScreenColumn' })}
    >
      {props.children}
    </div>
  );
}
