import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import styles from '../screen-layouts.module.css';
import { SCREEN_MAX_WIDTH, type ScreenMeasure } from '../screen-measure';
import { useMeasureCentered } from '../use-measure-centered';

/**
 * Shared measure and section rhythm for routed screen bodies and footers.
 * Centered wherever the frame is wider than the measure, except inside an
 * open space, where it keeps the space bar's leading edge
 * ({@link useMeasureCentered}).
 */
export function ScreenColumn(props: {
  children: JSX.Element;
  width?: ScreenMeasure | undefined;
}): JSX.Element {
  const centered = useMeasureCentered();
  return (
    <div
      class={styles['column']}
      classList={{ 'mx-auto': centered() }}
      style={{ 'max-width': SCREEN_MAX_WIDTH[props.width ?? 'prose'] }}
      {...dataAttrs({ component: 'ScreenColumn' })}
    >
      {props.children}
    </div>
  );
}
