/** @jsxImportSource solid-js */
/**
 * `ModalRoot` -- transparent modal wrapper.
 *
 * Renders into {@link SurfaceStackProvider} (via {@link SurfaceStackSlot})
 * with a monotonic z-index so nested surfaces stack by open order. The layer
 * fades in through {@link Motion}; unmount is instant (no exit fade), so the
 * stack entry and the DOM always agree with `visible`.
 *
 * {@link FocusTrap} keeps Tab focus inside the topmost modal, restores it on
 * close, exposes `role="dialog"` named by the {@link ModalHeader} title
 * (`aria-labelledby`), and dismisses on Escape via `onRequestClose` -- only
 * while this surface is on top, so Escape never closes an underlay.
 *
 * Resets the on-color context at the modal boundary so text opened from a
 * colored surface does not inherit a white foreground on the neutral fill.
 */

import { createUniqueId, type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { OnColorReset } from '../../theme';
import { FocusTrap } from '../focus-trap';
import { Motion } from '../motion';
import { SurfaceStackSlot, useIsTopSurface } from '../surface-stack';
import { ModalTitleIdProvider } from './modal-title-id';

export type ModalRootProps = {
  visible: boolean;
  onRequestClose: () => void;
  /**
   * Stable surface-stack id. Prefer a constant for surfaces that remount
   * (e.g. live-spaces list) so they restore under overlays instead of
   * stealing the top slot. Defaults to a generated unique id.
   */
  stackId?: string | undefined;
  /** Accessible name fallback when no {@link ModalHeader} renders a title. */
  label?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  children?: JSX.Element | undefined;
};

const ENTER_SX = { opacity: 0 } as const;

export function ModalRoot(props: ModalRootProps): JSX.Element {
  const generatedId = createUniqueId();
  const titleId = `modal-title-${createUniqueId()}`;
  const surfaceId = (): string => props.stackId ?? generatedId;
  const isTop = useIsTopSurface(surfaceId);
  const active = (): boolean => props.visible && isTop();
  return (
    <Show when={props.visible}>
      <SurfaceStackSlot id={surfaceId()} visible>
        <Motion
          class="absolute inset-0 flex-1"
          duration="fast"
          property="opacity"
          enterStyle={ENTER_SX}
          dataSet={{ component: 'ModalRoot', ...props.dataSet }}
        >
          <OnColorReset>
            <ModalTitleIdProvider id={titleId}>
              <FocusTrap
                active={active()}
                onEscape={active() ? props.onRequestClose : undefined}
                labelledBy={titleId}
                label={props.label}
              >
                {props.children}
              </FocusTrap>
            </ModalTitleIdProvider>
          </OnColorReset>
        </Motion>
      </SurfaceStackSlot>
    </Show>
  );
}
