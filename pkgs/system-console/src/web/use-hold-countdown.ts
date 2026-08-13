import { useEffect, useRef, useState } from 'react';

import type { FlatFrame } from './frames';
import { playbackHoldMs } from './playback-hold';
import type { ReportNavState } from './router';
import {
  wallCancelAnimationFrame,
  wallNowMs,
  wallRequestAnimationFrame,
} from './wall';

/** Remaining hold ms while playing a long frame; otherwise null. */
export function useHoldCountdown(args: {
  readonly nav: ReportNavState;
  readonly activeFrameIdx: number;
  readonly previewFrame: FlatFrame | null;
  readonly minHoldMs: number;
}): number | null {
  const { nav, activeFrameIdx, previewFrame, minHoldMs } = args;
  const holdMs =
    nav.play && previewFrame
      ? playbackHoldMs({
          frame: previewFrame,
          mode: nav.mode,
          speed: nav.speed,
        })
      : 0;
  const active = nav.play && holdMs > minHoldMs;
  const frameKey = `${activeFrameIdx}:${nav.mode}:${nav.speed}:${holdMs}`;
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setRemainingMs(null);
      return;
    }
    startedAtRef.current = wallNowMs();
    setRemainingMs(holdMs);
    let raf = 0;
    const tick = () => {
      const left = Math.max(0, holdMs - (wallNowMs() - startedAtRef.current));
      setRemainingMs(left);
      if (left > 0) raf = wallRequestAnimationFrame(tick);
    };
    raf = wallRequestAnimationFrame(tick);
    return () => wallCancelAnimationFrame(raf);
  }, [active, frameKey, holdMs]);

  return remainingMs;
}
