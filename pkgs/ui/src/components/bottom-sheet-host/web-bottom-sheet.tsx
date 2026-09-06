/** @jsxImportSource solid-js */
/**
 * CSS bottom sheet -- the web {@link BottomSheetHost}.
 *
 * Registers in the surface stack ({@link SurfaceStackSlot}) so it layers by
 * open order with modals, pins to the bottom of the stack layer, and slides
 * up through {@link Motion}. A scrim backdrop dismisses on click; the
 * {@link FocusTrap} (`layout="sheet"`) provides `role="dialog"`, Tab
 * containment, focus restore, and Escape while the sheet is on top. The drag
 * handle is purely decorative (no gesture support on the web).
 */

import { createUniqueId, type JSX, Show } from 'solid-js';
import { OnColorReset, useThemeLayout } from '../../theme';
import { Box } from '../box';
import { FocusTrap } from '../focus-trap';
import styles from '../hosts.module.css';
import { ModalTitleIdProvider } from '../modal/modal-title-id';
import { Motion } from '../motion';
import { SurfaceStackSlot, useIsTopSurface } from '../surface-stack';
import type { BottomSheetHost, BottomSheetHostSheetProps } from './types';

/** Content-hugging sheets never exceed this share of the layout height. */
export const BOTTOM_SHEET_MAX_HEIGHT_RATIO = 0.9;

const SHEET_ENTER_SX = { opacity: 0, transform: [{ translateY: 48 }] } as const;
const SCRIM_ENTER_SX = { opacity: 0 } as const;

function DragHandle(): JSX.Element {
  return (
    <Box
      aria-hidden="true"
      sx={{ alignItems: 'center', pt: 2, pb: 1 }}
      dataSet={{ component: 'BottomSheetHandle' }}
    >
      <Box
        sx={{
          width: 36,
          height: 4,
          borderRadius: 'full',
          background: 'border',
        }}
      />
    </Box>
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
        <Motion
          aria-hidden="true"
          duration="fast"
          property="opacity"
          enterSx={SCRIM_ENTER_SX}
          onClick={() => props.onClose()}
          sx={{ absoluteFill: true, backgroundColor: 'scrim' }}
          dataSet={{ component: 'BottomSheetScrim' }}
        />
        <Motion
          enterSx={SHEET_ENTER_SX}
          class={styles['safeBottom']}
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: maxHeight(),
            ...(props.height !== undefined ? { height: props.height } : {}),
            backgroundColor: 'surface',
            borderTopLeftRadius: 'xl',
            borderTopRightRadius: 'xl',
            borderWidth: 1,
            borderColor: 'border',
            overflow: 'hidden',
            elevation: 4,
          }}
          dataSet={{
            component: 'BottomSheet',
            surface: 'sheet',
            ...props.dataSet,
          }}
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
                sx={{ minHeight: 0, flexShrink: 1, overflow: 'hidden' }}
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

/** The default host: a CSS bottom sheet inside the surface stack. */
export function createWebBottomSheetHost(): BottomSheetHost {
  return { Sheet: WebBottomSheet, supportsSheetPresentation: true };
}
