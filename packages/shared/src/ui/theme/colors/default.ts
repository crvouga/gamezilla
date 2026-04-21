import { COLORS_BLUE_AND_NEUTRAL } from './colors-blue-and-neutral';
import { COLORS_PURPLE } from './colors-purple';
import { Colors } from './types';

const COLORS = {
  blueAndNeutral: COLORS_BLUE_AND_NEUTRAL,
  purple: COLORS_PURPLE,
} as const;

export const defaultColors: Colors = COLORS.blueAndNeutral;
