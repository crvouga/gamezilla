import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { type LayoutRectangle, Platform, type View } from 'react-native';

import {
  claimActiveTooltip,
  releaseActiveTooltip,
} from './tooltip-coordinator';

export function useTooltipState(anchorRef: RefObject<View | null>): {
  visible: boolean;
  enterKey: number;
  anchor: LayoutRectangle | null;
  show: () => void;
  hide: () => void;
} {
  const [visible, setVisible] = useState(false);
  const [enterKey, setEnterKey] = useState(0);
  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null);
  const showGenerationRef = useRef(0);
  const hideRef = useRef<() => void>(() => {});

  hideRef.current = () => {
    showGenerationRef.current += 1;
    setVisible(false);
    setAnchor(null);
    releaseActiveTooltip(hideRef.current);
  };

  const hide = useCallback(() => {
    hideRef.current();
  }, []);

  const measureAnchor = useCallback((): void => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
  }, [anchorRef]);

  const show = useCallback(() => {
    const generation = showGenerationRef.current + 1;
    showGenerationRef.current = generation;
    claimActiveTooltip(() => hideRef.current());
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      if (generation !== showGenerationRef.current) return;
      setAnchor({ x, y, width, height });
      setEnterKey((key) => key + 1);
      setVisible(true);
    });
  }, [anchorRef]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const update = (): void => {
      measureAnchor();
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [visible, measureAnchor]);

  useEffect(() => {
    return () => {
      releaseActiveTooltip(hideRef.current);
    };
  }, []);

  return { visible, enterKey, anchor, show, hide };
}
