import type { SymbolViewProps } from 'expo-symbols';

type IconMapping = Record<
  SymbolViewProps['name'],
  string
>;

/**
 * SF Symbol name → Material Icons name for Android / web.
 */
export const ICON_SYMBOL_TO_MATERIAL = {
  'house.fill': 'home',
  'person.fill': 'person',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  checklist: 'checklist',
  'paintbrush.fill': 'brush',
  ellipsis: 'more-horiz',
} as const satisfies Partial<IconMapping>;

export type IconSymbolName = keyof typeof ICON_SYMBOL_TO_MATERIAL;
