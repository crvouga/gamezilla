import { t } from '@lingui/core/macro';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { Button } from '../button/index';
import { ResponsiveSurface } from '../responsive-surface/index';
import styles from './word-tile-overview.module.css';
import { WordTileSquareDetails } from './word-tile-square-details';

/**
 * A phone's view tools behind one Board tools button under the board: Fit
 * and Enlarge, the whole-board overview and Find a square open in a centred
 * dialog, so the board keeps the height. The chosen square's details stay
 * beside the button.
 */
export function WordTileViewMenu(props: {
  testId: string;
  /** The chosen square's whole name. */
  position: string;
  /** Its short readout line, when the cell gives one. */
  detail?: string | undefined;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div class={styles['bar']} data-view-bar>
      <Button
        title={t`Board tools`}
        aria-label={t`Board tools: zoom and find a square`}
        aria-haspopup="dialog"
        size="sm"
        variant="outline"
        dataSet={{ testid: `${props.testId}-view` }}
        onClick={props.onOpen}
      />
      <WordTileSquareDetails
        testId={props.testId}
        label={props.position}
        detail={props.detail}
      />
      <Show when={props.open}>
        <ResponsiveSurface
          visible={props.open}
          onClose={props.onClose}
          title={t`Board tools`}
          size="small"
        >
          {props.children}
        </ResponsiveSurface>
      </Show>
    </div>
  );
}
