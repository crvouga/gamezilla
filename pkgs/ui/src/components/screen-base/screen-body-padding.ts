/**
 * Spacing-scale step for {@link ScreenBase} body padding (`1` = 4px → 16px).
 * Nested body scrollers cancel this horizontally via
 * {@link ScreenBodyScrollView} / {@link ScreenBodyFlatList}; {@link MenuList}
 * cancels it with `mx: -SCREEN_BODY_PADDING_STEP`.
 */
export const SCREEN_BODY_PADDING_STEP = 4;
