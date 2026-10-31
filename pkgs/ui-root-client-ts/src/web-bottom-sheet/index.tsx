/** @jsxImportSource solid-js */
/**
 * CSS bottom sheet -- the web {@link BottomSheetHost}, and the phone form of
 * {@link ResponsiveSurface} (screens open a sheet through
 * `ResponsiveSurface`, never through this host directly).
 *
 * Registers in the surface stack ({@link SurfaceStackSlot}) so it layers by
 * open order with modals and pins to the bottom of the stack layer. The look
 * is the brief's sheet: the raised `surface-elevated` fill, the 20px `sheet`
 * radius on the top corners, the one `shadow-float` (it floats over the
 * page), a 36x4 grab handle in the `border` tone, and the safe-area inset
 * under the content. No hairline: tone and shadow separate it from the scrim.
 *
 * It rises in over 200ms (`.sheetEnter`) while the scrim fades
 * (`.scrimEnter`); reduced motion shows both at once. Mounting is immediate,
 * so focus and dialog semantics never wait on the animation. Tapping the
 * scrim closes it; the {@link FocusTrap} (`layout="sheet"`) provides
 * `role="dialog"`, Tab containment, focus restore, and Escape while the sheet
 * is on top. The handle is decorative (no drag gesture on the web).
 */

import type {
  BottomSheetHost,
  BottomSheetHostSheetProps,
} from '@pkgs/ui-root-shared-ts/bottom-sheet-host-types';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';
import { createUniqueId, type JSX, Show } from 'solid-js';
import { FocusTrap } from '../focus-trap/index';
import { ModalTitleIdProvider } from '../modal-title-id/index';
import { OnColorReset } from '../on-color-context/index';
import { SurfaceStackSlot, useIsTopSurface } from '../surface-stack/index';
import { useThemeLayout } from '../theme-context/index';

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

export type BottomSheetPanelProps = {
  /** Fixed height in px; omit to hug the content. */
  height?: number | undefined;
  /** Height cap in px (the host passes 90% of the layout height). */
  maxHeight: number;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  children?: JSX.Element | undefined;
};

/**
 * The sheet itself, pinned to the bottom of its positioned parent: fill,
 * top radius, float shadow, grab handle and safe-area inset. The web host
 * puts it in the surface stack over a scrim; the explorer draws it in place.
 */
export function BottomSheetPanel(props: BottomSheetPanelProps): JSX.Element {
  return (
    <div
      class="box sheetEnter safeBottom absolute left-0 right-0 bottom-0 bg-surface-elevated rounded-t-sheet shadow-float overflow-hidden"
      style={{
        ...(props.height !== undefined ? { height: cssPx(props.height) } : {}),
        'max-height': cssPx(props.maxHeight),
      }}
      {...dataAttrs({
        component: 'BottomSheet',
        surface: 'sheet',
        ...props.dataSet,
      })}
    >
      <DragHandle />
      {props.children}
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
        <BottomSheetPanel
          height={props.height}
          maxHeight={maxHeight()}
          dataSet={props.dataSet}
        >
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
        </BottomSheetPanel>
      </SurfaceStackSlot>
    </Show>
  );
}

/** The default host: a CSS bottom sheet inside the surface stack. */
export function createWebBottomSheetHost(): BottomSheetHost {
  return { Sheet: WebBottomSheet, supportsSheetPresentation: true };
}
