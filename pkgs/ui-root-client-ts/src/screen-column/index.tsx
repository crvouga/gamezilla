import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import styles from '../screen-layouts.module.css';
import { SCREEN_MAX_WIDTH, type ScreenMeasure } from '../screen-measure';
import { useLayoutMode } from '../use-layout-mode';

/**
 * Shared measure and section rhythm for routed screen bodies and footers.
 * Compact hosts wider than the measure (tablets) center it. Wide, the frame
 * column is already centered, so the measure keeps that column's leading
 * edge and every screen's content starts at the same x.
 */
export function ScreenColumn(props: {
  children: JSX.Element;
  width?: ScreenMeasure | undefined;
}): JSX.Element {
  const mode = useLayoutMode();
  return (
    <div
      class={styles['column']}
      classList={{ 'mx-auto': mode() === 'compact' }}
      style={{ 'max-width': SCREEN_MAX_WIDTH[props.width ?? 'prose'] }}
      {...dataAttrs({ component: 'ScreenColumn' })}
    >
      {props.children}
    </div>
  );
}
