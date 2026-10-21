import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';
import styles from './screen-layouts.module.css';
import {
  SCREEN_MAX_WIDTH,
  type ScreenMeasure,
  useScreenMeasureCentered,
} from './screen-measure';

/**
 * Shared measure and section rhythm for routed screen bodies and footers.
 * Wide layouts center the column (the wide page header shares it); compact
 * layouts keep it on the page edge.
 */
export function ScreenColumn(props: {
  children: JSX.Element;
  width?: ScreenMeasure | undefined;
}): JSX.Element {
  const centered = useScreenMeasureCentered();
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
