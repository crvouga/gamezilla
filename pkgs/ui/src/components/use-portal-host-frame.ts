/**
 * Measures a portal provider root's window frame on layout so absolute
 * overlays can convert `measureInWindow` anchors into host-local coords.
 */

import { type RefObject, useCallback, useRef, useState } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';

import {
  type PortalHostFrame,
  portalHostFramesEqual,
  ZERO_PORTAL_HOST_FRAME,
} from './portal-host-frame';

export type PortalHostFrameController = {
  hostRef: RefObject<View | null>;
  frame: PortalHostFrame;
  onLayout: (event: LayoutChangeEvent) => void;
  remountMeasure: () => void;
};

export function usePortalHostFrameMeasure(): PortalHostFrameController {
  const hostRef = useRef<View | null>(null);
  const [frame, setFrame] = useState<PortalHostFrame>(ZERO_PORTAL_HOST_FRAME);

  const remountMeasure = useCallback(() => {
    hostRef.current?.measureInWindow((x, y, width, height) => {
      const next: PortalHostFrame = { x, y, width, height };
      setFrame((prev) => (portalHostFramesEqual(prev, next) ? prev : next));
    });
  }, []);

  const onLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      remountMeasure();
    },
    [remountMeasure]
  );

  return { hostRef, frame, onLayout, remountMeasure };
}
