/**
 * Spacing-scale step for {@link ScreenBase} body padding (`1` = 4px → 16px).
 * Nested body scrollers cancel this horizontally via the
 * {@link ContentEdgePaddingProvider} on the body (see {@link ScrollView} /
 * {@link FlatList}); {@link MenuList} cancels it with
 * `mx: -SCREEN_BODY_PADDING_STEP`.
 */

export { CONTENT_EDGE_PADDING_STEP as SCREEN_BODY_PADDING_STEP } from '../content-edge-padding';
