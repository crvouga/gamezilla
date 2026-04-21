import type { ScreenBaseAction } from './screen-base-types';

const MAX_INLINE_MOBILE = 2;
const MAX_INLINE_WIDE = 4;

/**
 * Splits actions into inline header buttons vs overflow menu. Preserves original order.
 */
export function partitionScreenActions(
  actions: ScreenBaseAction[] | undefined,
  isMobile: boolean
): { inline: ScreenBaseAction[]; overflow: ScreenBaseAction[] } {
  if (actions === undefined || actions.length === 0) {
    return { inline: [], overflow: [] };
  }

  const maxInline = isMobile ? MAX_INLINE_MOBILE : MAX_INLINE_WIDE;
  const inline: ScreenBaseAction[] = [];
  const overflow: ScreenBaseAction[] = [];
  let inlineCount = 0;

  for (const a of actions) {
    if (a.overflow === 'always') {
      overflow.push(a);
      continue;
    }
    if (a.overflow === 'never') {
      if (inlineCount < maxInline) {
        inline.push(a);
        inlineCount += 1;
      } else {
        overflow.push(a);
      }
      continue;
    }
    // auto (default)
    if (inlineCount < maxInline) {
      inline.push(a);
      inlineCount += 1;
    } else {
      overflow.push(a);
    }
  }

  return { inline, overflow };
}
