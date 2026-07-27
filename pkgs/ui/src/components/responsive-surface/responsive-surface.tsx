/**
 * `ResponsiveSurface` — overlay that uses a bottom sheet on mobile and a
 * centered modal on tablet/desktop, based on `theme.breakpoint`.
 *
 * Content uses {@link CONTENT_EDGE_PADDING_STEP} horizontal inset and
 * {@link SURFACE_BOTTOM_PADDING_STEP} bottom inset, via
 * {@link ContentEdgePaddingProvider}, so nested {@link ScrollView} /
 * {@link FlatList} scrollbars sit flush with the surface edges (padding lives
 * inside the scrollable area).
 */

import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import type { PropsWithChildren, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import {
  componentDataSet,
  type ComponentDataSet,
} from '../../component-id';
import { useTheme, OnColorReset } from '../../theme';
import type { ModalSize } from '../../theme/modal-size';
import { spacing } from '../../theme/scale';
import { Box } from '../box';
import {
  CONTENT_EDGE_PADDING_STEP,
  ContentEdgePaddingProvider,
  SURFACE_BOTTOM_PADDING_STEP,
} from '../content-edge-padding';
import { ModalBackdrop } from '../modal/modal-backdrop';
import { ModalContent } from '../modal/modal-content';
import { ModalRoot } from '../modal/modal-root';
import { FocusTrap } from '../focus-trap';
import { usePortalContentWrap } from '../portal-content-bridge';
import { ResponsiveSurfaceHeader } from './responsive-surface-header';

export type ResponsiveSurfaceProps = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  /** Optional title row above `children`. */
  title?: ReactNode;
  /** Centered modal width bucket on tablet/desktop. Default `medium`. */
  size?: ModalSize;
  /** Max height of centered modal content in px (tablet/desktop only). */
  maxHeight?: number;
  /** Bottom sheet snap points when `breakpoint === 'mobile'`. */
  snapPoints?: (string | number)[];
  /**
   * Fixed pixel height for the body region (everything below the title). Use
   * when the body's content can swap between payloads of varying height (e.g.
   * tabbed inspectors) and you want the surface to keep a stable shape across
   * those swaps. Overflowing children are clipped; they should provide their
   * own internal scroll if needed.
   *
   * On mobile, the body still stretches with the bottom sheet's snap point
   * but is guaranteed to be at least this tall.
   */
  bodyHeight?: number;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
}>;

export function ResponsiveSurface(props: ResponsiveSurfaceProps) {
  const theme = useTheme();
  const wrapPortalContent = usePortalContentWrap();
  const bridgedProps = {
    ...props,
    children: wrapPortalContent(props.children),
  };
  if (theme.breakpoint === 'mobile') return <MobileSheet {...bridgedProps} />;
  return <DesktopModal {...bridgedProps} />;
}

function SurfaceBody({
  bodyHeight,
  fillParent,
  children,
}: {
  bodyHeight: number | undefined;
  /** When true, body stretches to fill its parent (mobile bottom sheet). */
  fillParent: boolean;
  children: ReactNode;
}) {
  if (bodyHeight === undefined) return <>{children}</>;
  const style = fillParent
    ? { flex: 1, minHeight: bodyHeight, overflow: 'hidden' as const }
    : { height: bodyHeight, overflow: 'hidden' as const };
  return <View style={style}>{children}</View>;
}

function SurfaceChrome({
  title,
  bodyHeight,
  fillParent,
  onClose,
  children,
}: {
  title: ReactNode | undefined;
  bodyHeight: number | undefined;
  fillParent: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <ContentEdgePaddingProvider
      step={CONTENT_EDGE_PADDING_STEP}
      bottomStep={SURFACE_BOTTOM_PADDING_STEP}
    >
      <OnColorReset>
        {title !== undefined ? (
          <ResponsiveSurfaceHeader title={title} onClose={onClose} />
        ) : null}
        <SurfaceBody bodyHeight={bodyHeight} fillParent={fillParent}>
          {children}
        </SurfaceBody>
      </OnColorReset>
    </ContentEdgePaddingProvider>
  );
}

function useBottomSheetModalVisibility(
  visible: boolean,
  onClose: () => void
): {
  sheetRef: React.RefObject<React.ElementRef<typeof BottomSheetModal> | null>;
  onDismiss: () => void;
  onChange: (index: number) => void;
} {
  const sheetRef = useRef<React.ElementRef<typeof BottomSheetModal>>(null);
  const hasPresentedRef = useRef(false);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (sheet === null) return;
    if (visible) {
      hasPresentedRef.current = true;
      sheet.present();
      return;
    }
    if (hasPresentedRef.current) sheet.dismiss();
  }, [visible]);

  const onDismiss = useCallback(() => {
    hasPresentedRef.current = false;
  }, []);

  const onChange = useCallback(
    (index: number) => {
      if (index === -1) hasPresentedRef.current = false;
      if (index === -1 && visible) onClose();
    },
    [onClose, visible]
  );

  return { sheetRef, onDismiss, onChange };
}

function MobileSheet({
  visible,
  onClose,
  title,
  snapPoints: snapPointsProp,
  bodyHeight,
  children,
  dataSet,
}: ResponsiveSurfaceProps) {
  const theme = useTheme();
  const { sheetRef, onDismiss, onChange } = useBottomSheetModalVisibility(
    visible,
    onClose
  );
  const snapPoints = useMemo(() => snapPointsProp ?? ['80%'], [snapPointsProp]);
  const edgePadPx = spacing[CONTENT_EDGE_PADDING_STEP];
  const dismissSheet = useCallback(() => {
    sheetRef.current?.dismiss();
  }, [sheetRef]);

  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...backdropProps}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onDismiss={onDismiss}
      onChange={onChange}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
    >
      <BottomSheetView
        {...componentDataSet('ResponsiveSurface', dataSet)}
        style={{
          paddingHorizontal: edgePadPx,
          paddingTop: edgePadPx,
          paddingBottom: spacing[SURFACE_BOTTOM_PADDING_STEP],
          flexGrow: 1,
        }}
      >
        <FocusTrap active={visible} onEscape={dismissSheet}>
          <SurfaceChrome
            title={title}
            bodyHeight={bodyHeight}
            fillParent
            onClose={dismissSheet}
          >
            {children}
          </SurfaceChrome>
        </FocusTrap>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

function DesktopModal({
  visible,
  onClose,
  title,
  size = 'medium',
  maxHeight,
  bodyHeight,
  children,
  dataSet,
}: ResponsiveSurfaceProps) {
  return (
    <ModalRoot visible={visible} onRequestClose={onClose}>
      <ModalBackdrop
        onPress={onClose}
        {...componentDataSet('ResponsiveSurface', dataSet)}
      >
        <ModalContent
          size={size}
          padded={false}
          {...(maxHeight !== undefined ? { maxHeight } : {})}
        >
          <Box
            sx={{
              px: CONTENT_EDGE_PADDING_STEP,
              pt: CONTENT_EDGE_PADDING_STEP,
              pb: SURFACE_BOTTOM_PADDING_STEP,
            }}
          >
            <SurfaceChrome
              title={title}
              bodyHeight={bodyHeight}
              fillParent={false}
              onClose={onClose}
            >
              {children}
            </SurfaceChrome>
          </Box>
        </ModalContent>
      </ModalBackdrop>
    </ModalRoot>
  );
}
