import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { ScreenBase } from '../screen-base/index';
import type { ScreenBaseProps } from '../screen-base-types';
import styles from '../screen-layouts.module.css';
import type { ScreenMeasure } from '../screen-measure';
import { createScreenSlot } from '../screen-slot';
import { useLayoutMode } from '../use-layout-mode';

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
  /**
   * Desktop context beside the list (a 320px column at the trailing edge):
   * what helps a person act on the collection, such as who is playing now
   * or what needs an answer. Desktop only; a phone shows the list alone, so
   * nothing here may be the only way to reach something.
   */
  aside?: JSX.Element | undefined;
  /**
   * `list` (the default) takes the whole desktop column; `prose` keeps a
   * feed read top to bottom (the inbox) at the reading measure on the
   * column's leading edge, so its rows and their controls stay together.
   */
  measure?: Extract<ScreenMeasure, 'list' | 'prose'> | undefined;
};

/**
 * A viewport-sized collection; the list owns scrolling, filters stay
 * visible. On desktop an `aside` sits beside the list.
 */
export function CollectionScreen(props: CollectionScreenProps): JSX.Element {
  const controls = createScreenSlot(() => props.controls);
  const mode = useLayoutMode();
  const aside = (): JSX.Element | undefined =>
    mode() === 'wide' ? props.aside : undefined;
  return (
    <ScreenBase
      screenId={props.screenId}
      breadcrumbs={props.breadcrumbs}
      actions={props.actions}
      primaryAction={props.primaryAction}
      renderActionsMenu={props.renderActionsMenu}
      measure={props.measure ?? 'list'}
      dataSet={{ component: 'CollectionScreen', ...props.dataSet }}
      content={() => (
        <div
          class={styles['collectionSplit']}
          classList={{ [styles['collectionSplitAside'] ?? '']: !!aside() }}
        >
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
          <Show when={aside()}>
            {(node) => (
              <aside
                class={styles['collectionAside']}
                {...dataAttrs({ component: 'CollectionAside' })}
              >
                {node()}
              </aside>
            )}
          </Show>
        </div>
      )}
    />
  );
}
