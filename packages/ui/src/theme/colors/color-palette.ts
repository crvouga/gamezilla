import { BLUE } from './color-palette-blue';
import { BRUTALISM } from './color-palette-brutalism';
import { PURPLE } from './color-palette-purple';
import type { ColorPalette } from './types';

const COLORS = {
  BLUE,
  PURPLE,
  BRUTALISM,
} as const;

export const COLOR_PALETTE: ColorPalette = COLORS.BLUE;
