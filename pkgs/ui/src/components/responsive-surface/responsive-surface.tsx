/**
 * `ResponsiveSurface` — overlay that uses a bottom sheet on mobile and a
 * centered modal on tablet/desktop, based on `theme.breakpoint`. Pass
 * `presentation="modal"` to always use the centered modal (including on
 * mobile).
 *
 * Content uses {@link CONTENT_EDGE_PADDING_STEP} horizontal inset and
 * {@link SURFACE_BOTTOM_PADDING_STEP} bottom inset, via
 * {@link ContentEdgePaddingProvider}, so nested {@link ScrollView} /
 * {@link FlatList} scrollbars sit flush with the surface edges (padding lives
 * inside the scrollable area). Centered modals without a fixed `bodyHeight`
 * wrap their chrome in a {@link ScrollView} capped to the viewport so short
 * panels (e.g. nested debugger hosts) can scroll instead of clipping.
 *
 * Mobile sheets require {@link BottomSheetHostProvider} (wired from ClientEnv).
 */

import type { PropsWithChildren, ReactNode, RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { OnColorReset, useTheme } from '../../theme';
import {
  MODAL_CONTENT_MARGIN_STEP,
  type ModalSize,
  resolveModalLayoutMaxHeight,
} from '../../theme/modal-size';
import { spacing } from '../../theme/scale';
import type {
  BottomSheetHostBackdropProps,
  BottomSheetModalMethods,
} from '../bottom-sheet-host';
import { useBottomSheetHost } from '../bottom-sheet-host';
import { Box } from '../box';
import {
  CONTENT_EDGE_PADDING_STEP,
  ContentEdgePaddingProvider,
  SURFACE_BOTTOM_PADDING_STEP,
} from '../content-edge-padding';
import { FocusTrap } from '../focus-trap';
import { ModalBackdrop } from '../modal/modal-backdrop';
import { ModalContent } from '../modal/modal-content';
import { ModalRoot } from '../modal/modal-root';
import { usePortalContentWrap } from '../portal-content-bridge';
import { ScrollView } from '../scroll-view';
import { bottomSheetModalContainer } from './bottom-sheet-modal-container';
import { ResponsiveSurfaceHeader } from './responsive-surface-header';
import { shouldUseMobileSheet } from './should-use-mobile-sheet';

export type ResponsiveSurfacePresentation = 'responsive' | 'modal';

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
   * `'responsive'` (default) — bottom sheet on mobile, centered modal on
   * tablet/desktop. `'modal'` — always centered modal, including on mobile
   * (auth confirm flows that should not be sheets).
   */
  presentation?: ResponsiveSurfacePresentation;
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
  /**
   * Stable id for the desktop surface stack. Use for surfaces that remount
   * while overlays stay open (e.g. live-spaces list) so they restore under
   * the overlay instead of stealing the top slot.
   */
  stackId?: string;
  /** `testID` for the header close control. */
  closeTestID?: string;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
}>;

export function ResponsiveSurface(props: ResponsiveSurfaceProps) {
  const theme = useTheme();
  const host = useBottomSheetHost();
  const wrapPortalContent = usePortalContentWrap();
  const bridgedProps = {
    ...props,
    children: wrapPortalContent(props.children),
  };
  const useSheet = shouldUseMobileSheet({
    presentation: props.presentation,
    breakpoint: theme.breakpoint,
    supportsSheetPresentation: host.supportsSheetPresentation,
  });
  if (useSheet) return <MobileSheet {...bridgedProps} />;
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
  const sx = fillParent
    ? { flex: 1, minHeight: bodyHeight, overflow: 'hidden' as const }
    : { height: bodyHeight, overflow: 'hidden' as const };
  return <Box sx={sx}>{children}</Box>;
}

function SurfaceChrome({
  title,
  bodyHeight,
  fillParent,
  onClose,
  closeTestID,
  children,
}: {
  title: ReactNode | undefined;
  bodyHeight: number | undefined;
  fillParent: boolean;
  onClose: () => void;
  closeTestID: string | undefined;
  children: ReactNode;
}) {
  return (
    <ContentEdgePaddingProvider
      step={CONTENT_EDGE_PADDING_STEP}
      bottomStep={SURFACE_BOTTOM_PADDING_STEP}
    >
      <OnColorReset>
        <ResponsiveSurfaceHeader
          {...(title !== undefined ? { title } : {})}
          onClose={onClose}
          {...(closeTestID !== undefined ? { closeTestID } : {})}
        />
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
  sheetRef: RefObject<BottomSheetModalMethods | null>;
  onDismiss: () => void;
  onChange: (index: number) => void;
} {
  const sheetRef = useRef<BottomSheetModalMethods | null>(null);
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
  const { Backdrop } = useBottomSheetHost();
  return useCallback(
    (backdropProps: BottomSheetHostBackdropProps) => (
      <Backdrop
        {...backdropProps}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [Backdrop]
  );
}

type MobileSheetBodyProps = {
  visible: boolean;
  title: ReactNode | undefined;
  bodyHeight: number | undefined;
  dynamicSizing: boolean;
  edgePadPx: number;
  dataSet: ComponentDataSet | undefined;
  closeTestID: string | undefined;
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
  closeTestID,
  onDismissSheet,
  children,
}: MobileSheetBodyProps) {
  const { View: SheetView } = useBottomSheetHost();
  return (
    <SheetView
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
          closeTestID={closeTestID}
        >
          {children}
        </SurfaceChrome>
      </FocusTrap>
    </SheetView>
  );
}

function MobileSheet({
  visible,
  onClose,
  title,
  snapPoints: snapPointsProp,
  bodyHeight,
  children,
  closeTestID,
  dataSet,
}: ResponsiveSurfaceProps) {
  const theme = useTheme();
  const { Modal } = useBottomSheetHost();
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
  // Panel-local height (ThemeProvider onLayout), not window — nested playground
  // roots must not size sheets from the browser viewport.
  const maxDynamicContentSize = useMemo(
    () => Math.round(theme.layout.height * 0.9),
    [theme.layout.height]
  );
  const dismissSheet = useCallback(() => {
    sheetRef.current?.dismiss();
  }, [sheetRef]);
  const renderBackdrop = useBottomSheetBackdrop();

  return (
    <Modal
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
        closeTestID={closeTestID}
        onDismissSheet={dismissSheet}
      >
        {children}
      </MobileSheetBody>
    </Modal>
  );
}

const desktopSurfacePaddingSx = {
  px: CONTENT_EDGE_PADDING_STEP,
  pt: CONTENT_EDGE_PADDING_STEP,
  pb: SURFACE_BOTTOM_PADDING_STEP,
} as const;

function useDesktopModalMaxHeight(maxHeight: number | undefined): number {
  const theme = useTheme();
  const marginPx = spacing[MODAL_CONTENT_MARGIN_STEP];
  const viewportMaxHeight = resolveModalLayoutMaxHeight(
    theme.layout.height,
    marginPx
  );
  return maxHeight === undefined
    ? viewportMaxHeight
    : Math.min(maxHeight, viewportMaxHeight);
}

function DesktopModal({
  visible,
  onClose,
  title,
  size = 'medium',
  maxHeight,
  bodyHeight,
  children,
  stackId,
  closeTestID,
  dataSet,
}: ResponsiveSurfaceProps) {
  const resolvedMaxHeight = useDesktopModalMaxHeight(maxHeight);
  const chrome = (
    <SurfaceChrome
      title={title}
      bodyHeight={bodyHeight}
      fillParent={false}
      onClose={onClose}
      closeTestID={closeTestID}
    >
      {children}
    </SurfaceChrome>
  );
  // Fixed-height bodies (inspectors) own their own scroll. Otherwise wrap so
  // short viewports can scroll — ModalContent only clips via maxHeight.
  const body =
    bodyHeight !== undefined ? (
      <Box sx={desktopSurfacePaddingSx}>{chrome}</Box>
    ) : (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        flushEdge={false}
        frameSx={{ maxHeight: resolvedMaxHeight }}
        sx={desktopSurfacePaddingSx}
      >
        {chrome}
      </ScrollView>
    );

  return (
    <ModalRoot
      visible={visible}
      onRequestClose={onClose}
      {...(stackId !== undefined ? { stackId } : {})}
    >
      <ModalBackdrop
        onPress={onClose}
        {...componentDataSet('ResponsiveSurface', dataSet)}
      >
        <ModalContent
          size={size}
          padded={false}
          {...(maxHeight !== undefined ? { maxHeight } : {})}
        >
          {body}
        </ModalContent>
      </ModalBackdrop>
    </ModalRoot>
  );
}
