/**
 * Native fade machine for {@link FadeSwitch}: sequential out → swap → in.
 */

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Easing,
  runOnJS,
  useSharedValue,
  type SharedValue,
  withTiming,
} from 'react-native-reanimated';

import { duration } from '../../theme/motion';

const FADE_MS = duration.normal;
const EASE = Easing.out(Easing.cubic);

export type FadePhase = 'idle' | 'out' | 'in';

type FadeContentArgs = {
  phase: FadePhase;
  stateKey: string;
  shownKey: string;
  children: ReactNode;
  held: ReactNode;
  lastStable: ReactNode;
};

export function resolveFadeContent(args: FadeContentArgs): ReactNode {
  const { phase, stateKey, shownKey, children, held, lastStable } = args;
  if (phase === 'idle' && stateKey === shownKey) return children;
  if (phase === 'idle') return lastStable;
  return held;
}

export type FadeMachine = {
  content: ReactNode;
  opacity: SharedValue<number>;
};

export function useFadeMachine(
  stateKey: string,
  children: ReactNode
): FadeMachine {
  const opacity = useSharedValue(1);
  const [held, setHeld] = useState(children);
  const [phase, setPhase] = useState<FadePhase>('idle');
  const [shownKey, setShownKey] = useState(stateKey);

  const targetKeyRef = useRef(stateKey);
  const childrenRef = useRef(children);
  const phaseRef = useRef<FadePhase>('idle');
  const shownKeyRef = useRef(stateKey);
  const lastStableRef = useRef(children);
  const skipInitialRef = useRef(true);

  childrenRef.current = children;
  targetKeyRef.current = stateKey;

  if (phase === 'idle' && stateKey === shownKey) {
    lastStableRef.current = children;
  }

  useEffect(() => {
    runFadeKeyChange({
      stateKey,
      children,
      opacity,
      skipInitialRef,
      shownKeyRef,
      lastStableRef,
      phaseRef,
      targetKeyRef,
      childrenRef,
      setShownKey,
      setHeld,
      setPhase,
    });
  }, [stateKey, children, opacity]);

  return {
    opacity,
    content: resolveFadeContent({
      phase,
      stateKey,
      shownKey,
      children,
      held,
      lastStable: lastStableRef.current,
    }),
  };
}

type KeyChangeArgs = {
  stateKey: string;
  children: ReactNode;
  opacity: SharedValue<number>;
  skipInitialRef: { current: boolean };
  shownKeyRef: { current: string };
  lastStableRef: { current: ReactNode };
  phaseRef: { current: FadePhase };
  targetKeyRef: { current: string };
  childrenRef: { current: ReactNode };
  setShownKey: (key: string) => void;
  setHeld: (node: ReactNode) => void;
  setPhase: (phase: FadePhase) => void;
};

function runFadeKeyChange(args: KeyChangeArgs): void {
  const {
    stateKey,
    children,
    opacity,
    skipInitialRef,
    shownKeyRef,
    lastStableRef,
    phaseRef,
    targetKeyRef,
    childrenRef,
    setShownKey,
    setHeld,
    setPhase,
  } = args;

  if (skipInitialRef.current) {
    skipInitialRef.current = false;
    shownKeyRef.current = stateKey;
    lastStableRef.current = children;
    setShownKey(stateKey);
    setHeld(children);
    return;
  }
  if (stateKey === shownKeyRef.current) return;
  if (phaseRef.current !== 'idle') return;

  const startFadeOut = (): void => {
    phaseRef.current = 'out';
    setPhase('out');
    setHeld(lastStableRef.current);
    opacity.value = withTiming(
      0,
      { duration: FADE_MS, easing: EASE },
      (finished) => {
        if (finished) runOnJS(swapAndFadeIn)();
      }
    );
  };

  const swapAndFadeIn = (): void => {
    const nextKey = targetKeyRef.current;
    const nextNode = childrenRef.current;
    shownKeyRef.current = nextKey;
    lastStableRef.current = nextNode;
    setShownKey(nextKey);
    setHeld(nextNode);
    opacity.value = 0;
    phaseRef.current = 'in';
    setPhase('in');
    opacity.value = withTiming(
      1,
      { duration: FADE_MS, easing: EASE },
      (finished) => {
        if (finished) runOnJS(onFadeInDone)();
      }
    );
  };

  const onFadeInDone = (): void => {
    phaseRef.current = 'idle';
    setPhase('idle');
    if (targetKeyRef.current !== shownKeyRef.current) {
      startFadeOut();
    }
  };

  startFadeOut();
}
