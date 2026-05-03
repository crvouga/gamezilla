/**
 * `ResponsiveSurface` — overlay that uses a bottom sheet on mobile and a
 * centered modal on tablet/desktop, based on `theme.breakpoint`.
 */

import type { PropsWithChildren, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useTheme } from '../../theme';
import { ModalBackdrop } from '../modal/modal-backdrop';
import { ModalContent } from '../modal/modal-content';
import { ModalRoot } from '../modal/modal-root';
import { ResponsiveSurfaceHeader } from './responsive-surface-header';

export type ResponsiveSurfaceProps = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  /** Optional title row above `children`. */
  title?: ReactNode;
  /** Max width of the centered modal content (px). */
  maxWidth?: number;
  /** Bottom sheet snap points when `breakpoint === 'mobile'`. */
  snapPoints?: (string | number)[];
}>;

export function ResponsiveSurface(props: ResponsiveSurfaceProps) {
  const theme = useTheme();
  if (theme.breakpoint === 'mobile') return <MobileSheet {...props} />;
  return <DesktopModal {...props} />;
}

function MobileSheet({
  visible,
  onClose,
  title,
  snapPoints: snapPointsProp,
  children,
}: ResponsiveSurfaceProps) {
  const theme = useTheme();
  const sheetRef = useRef<React.ElementRef<typeof BottomSheetModal>>(null);
  const snapPoints = useMemo(() => snapPointsProp ?? ['80%'], [snapPointsProp]);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (sheet === null) return;
    if (visible) sheet.present();
    else sheet.dismiss();
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
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
    >
      <BottomSheetView
        style={{ paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 }}
      >
        {title !== undefined ? (
          <ResponsiveSurfaceHeader
            title={title}
            onClose={() => sheetRef.current?.dismiss()}
          />
        ) : null}
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

function DesktopModal({
  visible,
  onClose,
  title,
  maxWidth = 400,
  children,
}: ResponsiveSurfaceProps) {
  return (
    <ModalRoot visible={visible} onRequestClose={onClose}>
      <ModalBackdrop onPress={onClose}>
        <ModalContent style={{ width: '100%', maxWidth }}>
          {title !== undefined ? (
            <ResponsiveSurfaceHeader title={title} onClose={onClose} />
          ) : null}
          {children}
        </ModalContent>
      </ModalBackdrop>
    </ModalRoot>
  );
}
