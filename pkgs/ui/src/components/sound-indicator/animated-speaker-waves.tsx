/**
 * `AnimatedSpeakerWaves` -- speaker-wave glyph (matches the static
 * `speaker.wave.fill` icon visually) with the three wave arcs marching
 * outward in an indefinite loop. Used by {@link SoundIndicator} for
 * its `'playing'` state.
 *
 * The icon is composed of four layered SVGs sharing a single
 * `0 0 640 512` viewBox (the same one Font Awesome's `volume-high`
 * uses), so the arcs line up pixel-perfect with the static icon when
 * the indicator swaps in / out of the playing state.
 *
 * Each wave arc lives in its own `<Svg>` wrapped by an `Animated.View`
 * so the opacity animation can run on the native driver -- only view
 * opacity changes per frame, no layout / paint work and no JS-thread
 * load. The cone is rendered separately and is always fully opaque.
 *
 * Marching loop: each step crossfades to the next wave, then holds it
 * bright for {@link HOLD_MS} before the next handoff. Leading with the
 * crossfade keeps the first motion in sync with when the indicator mounts
 * (TTS already playing), instead of an initial static beat.
 *
 * Path data is sourced from `@fortawesome/fontawesome-free` 6.5.2,
 * `solid/volume-high.svg` (Font Awesome, vendored for the playing animation).
 */

import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { USE_NATIVE_DRIVER } from '../../animation/use-native-driver';
import type { SxInput } from '../../theme';
import { AnimatedBox } from '../animated-box';
import { Box } from '../box';

const VIEW_BOX = '0 0 640 512';

const CONE_PATH =
  'M301.1 34.8C312.6 40 320 51.4 320 64V448c0 12.6-7.4 24-18.9 29.2s-25 3.1-34.4-5.3L131.8 352H64c-35.3 0-64-28.7-64-64V224c0-35.3 28.7-64 64-64h67.8L266.7 40.1c9.4-8.4 22.9-10.4 34.4-5.3z';

const INNER_WAVE_PATH =
  'M412.6 181.5C434.1 199.1 448 225.9 448 256s-13.9 56.9-35.4 74.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C393.1 284.4 400 271 400 256s-6.9-28.4-17.7-37.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5z';

const MIDDLE_WAVE_PATH =
  'M473.1 107c43.2 35.2 70.9 88.9 70.9 149s-27.7 113.8-70.9 149c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C475.3 341.3 496 301.1 496 256s-20.7-85.3-53.2-111.8c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5z';

const OUTER_WAVE_PATH =
  'M533.6 32.5C598.5 85.2 640 165.8 640 256s-41.5 170.7-106.4 223.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C557.5 398.2 592 331.2 592 256s-34.5-142.2-88.7-186.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5z';

/** How long each wave is held bright before crossfading to the next. */
const HOLD_MS = 120;
/** Crossfade duration when handing off between adjacent waves. */
const FADE_MS = 50;
/** Trough opacity for off waves. Low enough that the active wave clearly stands out. */
const MIN_OPACITY = 0.12;

export type AnimatedSpeakerWavesProps = {
  sx?: SxInput;
  size: number;
  color: string;
};

function fadeIn(value: Animated.Value): Animated.CompositeAnimation {
  return Animated.timing(value, {
    toValue: 1,
    duration: FADE_MS,
    easing: Easing.out(Easing.quad),
    useNativeDriver: USE_NATIVE_DRIVER,
  });
}

function fadeOut(value: Animated.Value): Animated.CompositeAnimation {
  return Animated.timing(value, {
    toValue: MIN_OPACITY,
    duration: FADE_MS,
    easing: Easing.in(Easing.quad),
    useNativeDriver: USE_NATIVE_DRIVER,
  });
}

/**
 * Crossfade two waves in lockstep: `out` dims as `in` brightens, then the
 * new wave stays bright for {@link HOLD_MS}. Leading with the crossfade
 * (not a delay) so motion starts the frame the component mounts — a leading
 * hold made the waves feel late vs TTS that was already audible.
 */
function crossfadeStep(
  outgoing: Animated.Value,
  incoming: Animated.Value
): Animated.CompositeAnimation {
  return Animated.sequence([
    Animated.parallel([fadeOut(outgoing), fadeIn(incoming)]),
    Animated.delay(HOLD_MS),
  ]);
}

export function AnimatedSpeakerWaves({
  sx,
  size,
  color,
}: AnimatedSpeakerWavesProps): ReactNode {
  const innerOpacity = useRef(new Animated.Value(1)).current;
  const middleOpacity = useRef(new Animated.Value(MIN_OPACITY)).current;
  const outerOpacity = useRef(new Animated.Value(MIN_OPACITY)).current;

  useEffect(() => {
    innerOpacity.setValue(1);
    middleOpacity.setValue(MIN_OPACITY);
    outerOpacity.setValue(MIN_OPACITY);

    const loop = Animated.loop(
      Animated.sequence([
        crossfadeStep(innerOpacity, middleOpacity),
        crossfadeStep(middleOpacity, outerOpacity),
        crossfadeStep(outerOpacity, innerOpacity),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [innerOpacity, middleOpacity, outerOpacity]);

  return (
    <Box sx={[sx, { width: size, height: size }]}>
      <Box sx={{ position: 'absolute', top: 0, left: 0 }}>
        <Svg width={size} height={size} viewBox={VIEW_BOX}>
          <Path d={CONE_PATH} fill={color} />
        </Svg>
      </Box>
      <AnimatedBox
        sx={{ position: 'absolute', top: 0, left: 0, opacity: innerOpacity }}
      >
        <Svg width={size} height={size} viewBox={VIEW_BOX}>
          <Path d={INNER_WAVE_PATH} fill={color} />
        </Svg>
      </AnimatedBox>
      <AnimatedBox
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          opacity: middleOpacity,
        }}
      >
        <Svg width={size} height={size} viewBox={VIEW_BOX}>
          <Path d={MIDDLE_WAVE_PATH} fill={color} />
        </Svg>
      </AnimatedBox>
      <AnimatedBox
        sx={{ position: 'absolute', top: 0, left: 0, opacity: outerOpacity }}
      >
        <Svg width={size} height={size} viewBox={VIEW_BOX}>
          <Path d={OUTER_WAVE_PATH} fill={color} />
        </Svg>
      </AnimatedBox>
    </Box>
  );
}
