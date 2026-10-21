/** @jsxImportSource solid-js */
/**
 * CSS bottom sheet -- the web {@link BottomSheetHost}.
 *
 * Registers in the surface stack ({@link SurfaceStackSlot}) so it layers by
 * open order with modals and pins to the bottom of the stack layer: the
 * canvas-toned `surface-elevated` fill, a 12px top radius, a hairline top
 * edge, a 36x4 grab handle in the border tone, and the safe-area inset under
 * the content. It rises in over 250ms (`.sheetEnter`) while the scrim fades
 * (`.scrimEnter`); reduced motion shows both at once. Mounting is immediate,
 * so focus and dialog semantics never wait on the animation. A scrim backdrop
 * dismisses on click; the
 * {@link FocusTrap} (`layout="sheet"`) provides `role="dialog"`, Tab
 * containment, focus restore, and Escape while the sheet is on top. The drag
 * handle is purely decorative (no gesture support on the web).
 */

import type {
  BottomSheetHost,
  BottomSheetHostSheetProps,
} from '@pkgs/ui-root-shared/bottom-sheet-host-types';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { cssPx } from '@pkgs/ui-root-shared/css-px';
import { createUniqueId, type JSX, Show } from 'solid-js';
import { FocusTrap } from './focus-trap';
import { ModalTitleIdProvider } from './modal-title-id';
import { OnColorReset } from './on-color-context';
import { SurfaceStackSlot, useIsTopSurface } from './surface-stack';
import { useThemeLayout } from './theme-context';

/** Content-hugging sheets never exceed this share of the layout height. */
export const BOTTOM_SHEET_MAX_HEIGHT_RATIO = 0.9;

function DragHandle(): JSX.Element {
  return (
    <div
      class="box items-center pt-2 pb-1"
      data-component="BottomSheetHandle"
      aria-hidden="true"
    >
      <div class="box w-9 h-1 rounded-full bg-border" />
    </div>
  );
}

export function WebBottomSheet(props: BottomSheetHostSheetProps): JSX.Element {
  const generatedId = createUniqueId();
  const titleId = `sheet-title-${createUniqueId()}`;
  const layout = useThemeLayout();
  const surfaceId = (): string => props.stackId ?? `sheet-${generatedId}`;
  const isTop = useIsTopSurface(surfaceId);
  const active = (): boolean => props.open && isTop();
  const maxHeight = (): number =>
    Math.round(layout.layout().height * BOTTOM_SHEET_MAX_HEIGHT_RATIO);
  return (
    <Show when={props.open}>
      <SurfaceStackSlot id={surfaceId()} visible>
        <div
          class="box scrimEnter absolute inset-0 bg-scrim"
          aria-hidden="true"
          onClick={() => props.onClose()}
          {...dataAttrs({ component: 'BottomSheetScrim' })}
        />
        <div
          class="box sheetEnter safeBottom absolute left-0 right-0 bottom-0 bg-surface-elevated rounded-t-sheet border border-b-0 border-border overflow-hidden"
          style={{
            ...(props.height !== undefined
              ? { height: cssPx(props.height) }
              : {}),
            'max-height': cssPx(maxHeight()),
          }}
          {...dataAttrs({
            component: 'BottomSheet',
            surface: 'sheet',
            ...props.dataSet,
          })}
        >
          <DragHandle />
          <OnColorReset>
            <ModalTitleIdProvider id={titleId}>
              <FocusTrap
                layout="sheet"
                active={active()}
                onEscape={active() ? props.onClose : undefined}
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

/** The default host: a CSS bottom sheet inside the surface stack. */
export function createWebBottomSheetHost(): BottomSheetHost {
  return { Sheet: WebBottomSheet, supportsSheetPresentation: true };
}
