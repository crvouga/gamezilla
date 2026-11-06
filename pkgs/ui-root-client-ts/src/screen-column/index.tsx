import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import styles from '../screen-layouts.module.css';
import type { ScreenMeasure } from '../screen-measure';
import { useScreenMeasure } from '../use-screen-measure';

/**
 * Shared measure and section rhythm for routed screen bodies and footers.
 * Capped and centered on compact hosts; on desktop it starts at the frame
 * column's edge, and only `prose` stays capped ({@link useScreenMeasure}).
 */
export function ScreenColumn(props: {
  children: JSX.Element;
  width?: ScreenMeasure | undefined;
}): JSX.Element {
  const measure = useScreenMeasure(() => props.width ?? 'prose');
  return (
    <div
      class={styles['column']}
      classList={{ 'mx-auto': measure().centered }}
      style={{ 'max-width': measure().maxWidth }}
      {...dataAttrs({ component: 'ScreenColumn' })}
    >
      {props.children}
    </div>
  );
}
