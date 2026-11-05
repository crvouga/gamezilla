/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import styles from './preview-thumbnail.module.css';

/** `md` 48px beside a row's title; `lg` 64px leading a card or a list row. */
export type PreviewThumbnailSize = 'md' | 'lg';

export type PreviewThumbnailProps = {
  /**
   * A picture of the thing (a puzzle's board preview, an icon): drawn at a
   * reader's size and shrunk to fit, so its proportions and its lines keep
   * their weight. Never interactive: it is inert and hidden from assistive
   * technology, so the row it leads keeps one name and one action.
   */
  children: JSX.Element;
  /** Defaults to `lg`. */
  size?: PreviewThumbnailSize | undefined;
  /**
   * A collection (a pack): a second sheet drawn behind the first, so a set
   * reads apart from one item at a glance, not by its label alone.
   */
  stacked?: boolean | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `PreviewThumbnail` -- a small, square picture of what a row opens: the
 * well tone inside the control radius, its content drawn four times larger
 * and scaled down to fit, centred, and clipped to the square.
 */
export function PreviewThumbnail(props: PreviewThumbnailProps): JSX.Element {
  return (
    <span
      class={styles['thumbnail']}
      data-size={props.size ?? 'lg'}
      data-stacked={props.stacked === true}
      aria-hidden="true"
      {...dataAttrs({ component: 'PreviewThumbnail', ...props.dataSet })}
    >
      <span class={styles['frame']} inert>
        <span class={styles['content']}>{props.children}</span>
      </span>
    </span>
  );
}
