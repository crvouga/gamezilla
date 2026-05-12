import { BLUE } from './color-palette-blue';
import { BRUTALISM } from './color-palette-brutalism';
import { CLAUDE } from './color-palette-claude';
import { PURPLE } from './color-palette-purple';
import type { ColorPalette } from './types';

const COLORS = {
  BLUE,
  PURPLE,
  BRUTALISM,
  CLAUDE,
} as const;

export const COLOR_PALETTE: ColorPalette = COLORS.PURPLE;
