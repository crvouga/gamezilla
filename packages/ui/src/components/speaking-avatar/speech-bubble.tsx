/**
 * Internal `SpeechBubble` -- rounded surface plate with a small
 * left-pointing tail. Used by {@link SpeakingAvatar}.
 *
 * The tail is a rotated `View` so we don't pull in an SVG dependency
 * just for a triangle.
 */

import type { ReactNode } from 'react';
import { View } from 'react-native';
import { defaultColors } from '../../theme';
import { borderRadius, elevation } from '../../theme/scale';
import { Text } from '../text';

const TAIL_SIZE = 12;
const BUBBLE_PADDING_VERTICAL = 12;
const BUBBLE_PADDING_HORIZONTAL = 16;
const BUBBLE_MIN_HEIGHT = 56;

export type SpeechBubbleProps = {
  text: string;
  /**
   * When non-empty, a thin trailing caret hint is appended after the text
   * to convey "still typing". Pass an empty string to hide it.
   */
  caret?: string;
};

export function SpeechBubble({
  text,
  caret = '',
}: SpeechBubbleProps): ReactNode {
  // Keep the bubble visually "light" in both schemes: in dark mode we
  // intentionally invert to the light palette's surface/text so the bubble
  // reads as a callout against the dark backdrop instead of blending in.
  const bubbleSurface = defaultColors.light.surface;
  const bubbleText = defaultColors.light.text;
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
      <View
        style={{
          width: TAIL_SIZE,
          height: TAIL_SIZE,
          backgroundColor: bubbleSurface,
          transform: [{ rotate: '45deg' }],
          marginRight: -TAIL_SIZE / 2,
        }}
      />
      <View
        style={[
          elevation(1),
          {
            flex: 1,
            backgroundColor: bubbleSurface,
            borderRadius: borderRadius.md,
            paddingVertical: BUBBLE_PADDING_VERTICAL,
            paddingHorizontal: BUBBLE_PADDING_HORIZONTAL,
            minHeight: BUBBLE_MIN_HEIGHT,
            justifyContent: 'center',
          },
        ]}
      >
        <Text
          variant="bodyBold"
          label={`${text}${caret}`}
          style={{ color: bubbleText }}
        />
      </View>
    </View>
  );
}
