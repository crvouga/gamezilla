/**
 * Spacing-scale step for `ScreenBase` body padding (`1` = 4px → 16px).
 * Nested body scrollers cancel this horizontally via the
 * `ContentEdgePaddingProvider` on the body (see `ScrollView` /
 * `VirtualList`); `MenuList` cancels it with `mx: -SCREEN_BODY_PADDING_STEP`.
 */

export { CONTENT_EDGE_PADDING_STEP as SCREEN_BODY_PADDING_STEP } from '../content-edge-padding';
