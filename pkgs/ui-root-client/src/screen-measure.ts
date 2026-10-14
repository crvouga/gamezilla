/** One measure for routed columns and embedded screen families. */
export type ScreenMeasure = 'reading' | 'stage';

export const SCREEN_MAX_WIDTH: Readonly<Record<ScreenMeasure, number>> = {
  reading: 480,
  stage: 1120,
};
