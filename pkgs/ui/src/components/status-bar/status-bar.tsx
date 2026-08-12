import { type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';

import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { useOverlayPortalSlot } from '../overlay-portal';
import { usePortalContentWrap } from '../portal-content-bridge';
import { StatusBarOverlay } from './status-bar-overlay';
import {
  StatusBarRegistryContext,
  type StatusBarRegistryContextValue,
  useStatusBarRegistry,
} from './status-bar-registry-context';
import { StatusBarStrip, useStatusBarPushHeight } from './status-bar-strip';
import { useStatusBarReveal } from './use-status-bar-reveal';

const OVERLAY_PORTAL_ID = 'app-status-bar';

/** Keep `grabbing` on the document while a pan is held (pointer may leave the handle). */
function useDocumentGrabbingCursor(isGrabbing: boolean): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!isGrabbing) return;
    const previous = document.body.style.cursor;
    document.body.style.cursor = 'grabbing';
    return () => {
      document.body.style.cursor = previous;
    };
  }, [isGrabbing]);
}

export type StatusBarProps = {
  /**
   * When true (default), reserves the strip body height so the absolute
   * overlay does not cover TopBar. Safe-area top inset stays on ScreenBase /
   * TopBar; the strip paints that zone and places icons below it.
   */
  reserveSpace?: boolean;
  /** Accessibility label for the thin strip (swipe down to open). */
  accessibilityLabel?: string;
  /** Accessibility label for the full-screen overlay. */
  panelTitle?: ReactNode;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

function panelTitleToLabel(panelTitle: ReactNode): string {
  if (typeof panelTitle === 'string') return panelTitle;
  if (typeof panelTitle === 'number') return String(panelTitle);
  return 'Status';
}

function useRegistryRevealSync(
  isOpen: boolean,
  syncOpen: () => void,
  syncClose: () => void
) {
  const ignoreNextOpenSync = useRef(false);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const onOpened = useCallback(() => {
    if (isOpenRef.current) return;
    ignoreNextOpenSync.current = true;
    syncOpen();
  }, [syncOpen]);

  const onClosed = useCallback(() => {
    if (!isOpenRef.current) return;
    ignoreNextOpenSync.current = true;
    syncClose();
  }, [syncClose]);

  const reveal = useStatusBarReveal({ onOpened, onClosed });
  const { openAnimated, closeAnimated } = reveal;

  const prevOpenRef = useRef(isOpen);
  useEffect(() => {
    if (prevOpenRef.current === isOpen) return;
    prevOpenRef.current = isOpen;
    if (ignoreNextOpenSync.current) {
      ignoreNextOpenSync.current = false;
      return;
    }
    if (isOpen) {
      openAnimated();
    } else {
      closeAnimated();
    }
  }, [closeAnimated, isOpen, openAnimated]);

  return reveal;
}

function useStatusBarOverlayPortal(
  registry: StatusBarRegistryContextValue,
  reveal: ReturnType<typeof useStatusBarReveal>,
  overlayLabel: string
): void {
  const wrapPortalContent = usePortalContentWrap();
  const {
    active,
    progress,
    handlePan,
    interactive,
    isGrabbing,
    closeAnimated,
  } = reveal;
  const overlayNode = useMemo(() => {
    if (!active) return null;
    return wrapPortalContent(
      <StatusBarRegistryContext.Provider value={registry}>
        <StatusBarOverlay
          items={registry.items}
          progress={progress}
          handlePan={handlePan}
          isGrabbing={isGrabbing}
          interactive={interactive}
          onRequestClose={closeAnimated}
          accessibilityLabel={overlayLabel}
        />
      </StatusBarRegistryContext.Provider>
    );
  }, [
    active,
    closeAnimated,
    handlePan,
    interactive,
    isGrabbing,
    overlayLabel,
    progress,
    registry,
    wrapPortalContent,
  ]);

  useOverlayPortalSlot(OVERLAY_PORTAL_ID, overlayNode, active);
}

/**
 * Global smartphone-style status bar host. Items come from
 * {@link StatusBarRegistryProvider} React state. Swipe down reveals a
 * full-screen Control Center overlay that follows the gesture.
 */
export function StatusBar({
  reserveSpace = true,
  accessibilityLabel = 'Status bar',
  panelTitle = 'Status',
  dataSet,
}: StatusBarProps): ReactNode {
  const registry = useStatusBarRegistry();
  const pushHeight = useStatusBarPushHeight();
  const overlayLabel = panelTitleToLabel(panelTitle);
  const reveal = useRegistryRevealSync(
    registry.isOpen,
    registry.open,
    registry.close
  );

  useDocumentGrabbingCursor(reveal.isGrabbing);
  useStatusBarOverlayPortal(registry, reveal, overlayLabel);

  return (
    <>
      {reserveSpace && pushHeight > 0 ? (
        <Box
          pointerEvents="none"
          sx={{
            height: pushHeight,
            backgroundColor: 'surface',
          }}
        />
      ) : null}
      <StatusBarStrip
        items={registry.items}
        openPan={reveal.openPan}
        isGrabbing={reveal.isGrabbing}
        onOpen={reveal.openAnimated}
        accessibilityLabel={accessibilityLabel}
        {...(dataSet !== undefined ? { dataSet } : {})}
      />
    </>
  );
}
