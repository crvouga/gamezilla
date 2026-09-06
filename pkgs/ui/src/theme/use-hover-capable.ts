import type { Accessor } from 'solid-js';
import { createMediaQuery } from './media-query';

/**
 * True when the primary input can hover with a fine pointer (mouse /
 * trackpad). Touch-first devices report false, so callers can skip sticky
 * `:hover` feedback there. Same idiom as CSS `@media (hover: hover) and
 * (pointer: fine)`.
 */
export const HOVER_CAPABLE_QUERY = '(hover: hover) and (pointer: fine)';

export function useHoverCapable(): Accessor<boolean> {
  return createMediaQuery(HOVER_CAPABLE_QUERY);
}
