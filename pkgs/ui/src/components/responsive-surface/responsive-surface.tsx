/**
 * `ResponsiveSurface` — overlay that uses a bottom sheet on mobile and a
 * centered modal on tablet/desktop, based on `theme.breakpoint`.
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
import { useTheme, OnColorReset } from '../../theme';
import type { ModalSize } from '../../theme/modal-size';
import { ModalBackdrop } from '../modal/modal-backdrop';
import { ModalContent } from '../modal/modal-content';
import { ModalRoot } from '../modal/modal-root';
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

function MobileSheetBody({
  title,
  bodyHeight,
  onClose,
  children,
}: {
  title: ReactNode | undefined;
  bodyHeight: number | undefined;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <OnColorReset>
      {title !== undefined ? (
        <ResponsiveSurfaceHeader title={title} onClose={onClose} />
      ) : null}
      <SurfaceBody bodyHeight={bodyHeight} fillParent>
        {children}
      </SurfaceBody>
    </OnColorReset>
  );
}

function MobileSheet({
  visible,
  onClose,
  title,
  snapPoints: snapPointsProp,
  bodyHeight,
  children,
}: ResponsiveSurfaceProps) {
  const theme = useTheme();
  const sheetRef = useRef<React.ElementRef<typeof BottomSheetModal>>(null);
  const hasPresentedRef = useRef(false);
  const snapPoints = useMemo(() => snapPointsProp ?? ['80%'], [snapPointsProp]);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (sheet === null) return;
    if (visible) {
      hasPresentedRef.current = true;
      sheet.present();
      return;
    }
    if (hasPresentedRef.current) {
      sheet.dismiss();
      return;
    }
  }, [visible]);

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
      onDismiss={() => {
        hasPresentedRef.current = false;
      }}
      onChange={(index) => {
        if (index === -1) hasPresentedRef.current = false;
        if (index === -1 && visible) onClose();
      }}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
    >
      <BottomSheetView
        style={{ paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 }}
      >
        <MobileSheetBody
          title={title}
          bodyHeight={bodyHeight}
          onClose={() => sheetRef.current?.dismiss()}
        >
          {children}
        </MobileSheetBody>
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
}: ResponsiveSurfaceProps) {
  return (
    <ModalRoot visible={visible} onRequestClose={onClose}>
      <ModalBackdrop onPress={onClose}>
        <ModalContent
          size={size}
          {...(maxHeight !== undefined ? { maxHeight } : {})}
        >
          {title !== undefined ? (
            <ResponsiveSurfaceHeader title={title} onClose={onClose} />
          ) : null}
          <SurfaceBody bodyHeight={bodyHeight} fillParent={false}>
            {children}
          </SurfaceBody>
        </ModalContent>
      </ModalBackdrop>
    </ModalRoot>
  );
}
