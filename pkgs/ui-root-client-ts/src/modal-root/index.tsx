/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, type JSX, Show } from 'solid-js';
import { FocusTrap } from '../focus-trap/index';
import { ModalTitleIdProvider } from '../modal-title-id/index';
import { OnColorReset } from '../on-color-context/index';
import { SurfaceStackSlot, useIsTopSurface } from '../surface-stack/index';

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

/**
 * `ModalRoot` -- transparent modal wrapper.
 *
 * Renders into {@link SurfaceStackProvider} (via {@link SurfaceStackSlot})
 * with a monotonic z-index so nested surfaces stack by open order. Mount and
 * unmount are instant (no enter/exit fade).
 *
 * {@link FocusTrap} keeps Tab focus inside the topmost modal, restores it on
 * close, exposes `role="dialog"` named by the {@link ModalHeader} title
 * (`aria-labelledby`), and dismisses on Escape via `onRequestClose` -- only
 * while this surface is on top, so Escape never closes an underlay.
 *
 * Resets the on-color context at the modal boundary so text opened from a
 * colored surface does not inherit a white foreground on the neutral fill.
 */
export function ModalRoot(props: ModalRootProps): JSX.Element {
  const generatedId = createUniqueId();
  const titleId = `modal-title-${createUniqueId()}`;
  const surfaceId = (): string => props.stackId ?? generatedId;
  const isTop = useIsTopSurface(surfaceId);
  const active = (): boolean => props.visible && isTop();
  return (
    <Show when={props.visible}>
      <SurfaceStackSlot id={surfaceId()} visible>
        <div
          class="box absolute inset-0 flex-1"
          {...dataAttrs({ component: 'ModalRoot', ...props.dataSet })}
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
        </div>
      </SurfaceStackSlot>
    </Show>
  );
}
