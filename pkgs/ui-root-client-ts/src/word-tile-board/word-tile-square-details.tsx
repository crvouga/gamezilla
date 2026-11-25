import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { P } from '../text/index';
import { VisuallyHidden } from '../visually-hidden/index';

/**
 * The chosen square's readout: a short visible line (`h8 · Start · Double
 * word`) when the cell gives one, with the square's whole name kept for
 * assistive technology; otherwise the whole name, shown.
 */
export function WordTileSquareDetails(props: {
  testId: string;
  /** The square's whole name, as its button says it. */
  label: string;
  /** The short line shown in its place, when the cell gives one. */
  detail?: string | undefined;
}): JSX.Element {
  return (
    <P variant="caption" testId={`${props.testId}-square-details`}>
      <Show when={props.detail} fallback={props.label}>
        {(detail) => (
          <>
            <span aria-hidden="true">{detail()}</span>
            <VisuallyHidden>{props.label}</VisuallyHidden>
          </>
        )}
      </Show>
    </P>
  );
}
