import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { ScreenBase } from '../screen-base/index';
import type { ScreenBaseProps } from '../screen-base-types';
import styles from '../screen-layouts.module.css';
import { createScreenSlot } from '../screen-slot';

export type CollectionScreenProps = Pick<
  ScreenBaseProps,
  | 'screenId'
  | 'breadcrumbs'
  | 'actions'
  | 'primaryAction'
  | 'dataSet'
  | 'renderActionsMenu'
> & {
  /** Pinned search, filters, or notices above the independently scrolling list. */
  controls?: JSX.Element | undefined;
  /** A ScreenBodyVirtualList / ScreenBodyScrollView, or an empty/loading state. */
  children: JSX.Element;
};

/** A viewport-sized collection; the list owns scrolling, filters stay visible. */
export function CollectionScreen(props: CollectionScreenProps): JSX.Element {
  const controls = createScreenSlot(() => props.controls);
  return (
    <ScreenBase
      screenId={props.screenId}
      breadcrumbs={props.breadcrumbs}
      actions={props.actions}
      primaryAction={props.primaryAction}
      renderActionsMenu={props.renderActionsMenu}
      dataSet={{ component: 'CollectionScreen', ...props.dataSet }}
      content={() => (
        <div class={styles['collection']}>
          <Show when={controls.present()}>
            <div
              class={`${styles['fixed']} gap-2`}
              {...dataAttrs({ component: 'CollectionControls' })}
            >
              {controls.content()}
            </div>
          </Show>
          <div
            class={styles['collection']}
            {...dataAttrs({ component: 'CollectionBody' })}
          >
            {props.children}
          </div>
        </div>
      )}
    />
  );
}
