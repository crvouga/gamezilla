import type { JSX } from 'solid-js';
import { ScreenBase } from './screen-base';
import type { ScreenBaseProps } from './screen-base-types';
import styles from './screen-layouts.module.css';

export type CollectionScreenProps = Pick<
  ScreenBaseProps,
  'screenId' | 'breadcrumbs' | 'actions' | 'primaryAction' | 'dataSet'
> & {
  /** Pinned search, filters, or notices above the independently scrolling list. */
  controls?: JSX.Element | undefined;
  /** A ScreenBodyVirtualList / ScreenBodyScrollView, or an empty/loading state. */
  children: JSX.Element;
};

/** A viewport-sized collection; the list owns scrolling, filters stay visible. */
export function CollectionScreen(props: CollectionScreenProps): JSX.Element {
  return (
    <ScreenBase
      screenId={props.screenId}
      breadcrumbs={props.breadcrumbs}
      actions={props.actions}
      primaryAction={props.primaryAction}
      surface="canvas"
      dataSet={{ component: 'CollectionScreen', ...props.dataSet }}
      content={() => (
        <div class={styles['collection']}>
          {props.controls}
          {props.children}
        </div>
      )}
    />
  );
}
