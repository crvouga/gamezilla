import { t } from '@lingui/core/macro';
import type { JSX } from '@solidjs/web';
import { onSettled, Show } from 'solid-js';
import { Button } from '../button/index';
import { createFocusTarget } from '../focus';
import { ResponsiveSurface } from '../responsive-surface/index';
import styles from './word-tile-overview.module.css';
import { WordTileSquareDetails } from './word-tile-square-details';

/**
 * A phone's view tools behind one Board tools button under the board: Fit
 * and Enlarge, the whole-board overview and Find a square open in a centred
 * dialog, so the board keeps the height. The chosen square's details stay
 * beside the button. Dismissing the dialog hands focus back to the button,
 * even after Find a square opened over it: the dialog's own restore then
 * aims at Find a square, which leaves with it.
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
  const trigger = createFocusTarget();
  const dismiss = (): void => {
    props.onClose();
    onSettled(() => {
      const active = document.activeElement;
      if (active === null || active === document.body || !active.isConnected)
        trigger.focus();
    });
  };
  return (
    <div class={styles['bar']} data-view-bar>
      <Button
        focusTarget={trigger.target}
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
          onClose={dismiss}
          title={t`Board tools`}
          size="small"
        >
          {props.children}
        </ResponsiveSurface>
      </Show>
    </div>
  );
}
