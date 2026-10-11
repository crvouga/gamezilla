/**
 * Surface-stack z-index arithmetic. The layers themselves are tokens
 * (`./layers`): open surfaces count up from the `surface` layer.
 */

import { layer } from './layers';

/** First open surface’s z-index. */
export const SURFACE_STACK_BASE = layer.surface;

/** Gap between successive surface layers. */
export const SURFACE_STACK_STEP = 10;
