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
import { useWindowDimensions, View } from 'react-native';
import { componentDataSet, type ComponentDataSet } from '../../component-id';
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
import { bottomSheetModalContainer } from './bottom-sheet-modal-container';
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
  /**
   * Fixed bottom-sheet snap points. When omitted, the sheet sizes to its
   * content (capped by the viewport). Pass explicitly only when you need a
   * stable tall sheet (e.g. scrollable inspectors).
   */
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

  // Sync React close from full dismiss only. `onChange(-1)` also fires on
  // stack minimize (`switch`), which must not tear down the parent surface.
  const onDismiss = useCallback(() => {
    hasPresentedRef.current = false;
    if (visible) onClose();
  }, [onClose, visible]);

  const onChange = useCallback((index: number) => {
    if (index === -1) hasPresentedRef.current = false;
  }, []);

  return { sheetRef, onDismiss, onChange };
}

function useBottomSheetBackdrop() {
  return useCallback(
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
}

type MobileSheetBodyProps = {
  visible: boolean;
  title: ReactNode | undefined;
  bodyHeight: number | undefined;
  dynamicSizing: boolean;
  edgePadPx: number;
  dataSet: ComponentDataSet | undefined;
  onDismissSheet: () => void;
  children: ReactNode;
};

function MobileSheetBody({
  visible,
  title,
  bodyHeight,
  dynamicSizing,
  edgePadPx,
  dataSet,
  onDismissSheet,
  children,
}: MobileSheetBodyProps) {
  return (
    <BottomSheetView
      {...componentDataSet('ResponsiveSurface', dataSet)}
      style={{
        paddingHorizontal: edgePadPx,
        paddingTop: edgePadPx,
        paddingBottom: spacing[SURFACE_BOTTOM_PADDING_STEP],
        // flexGrow only for fixed snaps — it breaks dynamic content measurement.
        ...(dynamicSizing ? {} : { flexGrow: 1 }),
      }}
    >
      <FocusTrap active={visible} onEscape={onDismissSheet} layout="sheet">
        <SurfaceChrome
          title={title}
          bodyHeight={bodyHeight}
          fillParent={!dynamicSizing}
          onClose={onDismissSheet}
        >
          {children}
        </SurfaceChrome>
      </FocusTrap>
    </BottomSheetView>
  );
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
  const { height: windowHeight } = useWindowDimensions();
  const { sheetRef, onDismiss, onChange } = useBottomSheetModalVisibility(
    visible,
    onClose
  );
  // Content-hug by default. Fixed snaps only when the caller opts in — mixing
  // both (v5 default dynamic + a snap) opens at the wrong height on web.
  const dynamicSizing = snapPointsProp === undefined;
  const snapPoints = useMemo(
    () => (dynamicSizing ? undefined : snapPointsProp),
    [dynamicSizing, snapPointsProp]
  );
  const maxDynamicContentSize = useMemo(
    () => Math.round(windowHeight * 0.9),
    [windowHeight]
  );
  const dismissSheet = useCallback(() => {
    sheetRef.current?.dismiss();
  }, [sheetRef]);
  const renderBackdrop = useBottomSheetBackdrop();

  return (
    <BottomSheetModal
      ref={sheetRef}
      {...(dynamicSizing
        ? {
            enableDynamicSizing: true as const,
            maxDynamicContentSize,
          }
        : {
            enableDynamicSizing: false as const,
            snapPoints: snapPoints ?? ['50%'],
          })}
      stackBehavior="push"
      enablePanDownToClose
      onDismiss={onDismiss}
      onChange={onChange}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      {...(bottomSheetModalContainer !== undefined
        ? { containerComponent: bottomSheetModalContainer }
        : {})}
    >
      <MobileSheetBody
        visible={visible}
        title={title}
        bodyHeight={bodyHeight}
        dynamicSizing={dynamicSizing}
        edgePadPx={spacing[CONTENT_EDGE_PADDING_STEP]}
        dataSet={dataSet}
        onDismissSheet={dismissSheet}
      >
        {children}
      </MobileSheetBody>
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
