/**
 * Single registry: public `IconSymbol` names → Font Awesome 7.x solid SVG components.
 * Source filenames: see table in ATTRIBUTION.md.
 */

import type { ComponentType } from 'react';

import {
  ChecklistFa,
  ChevronRightFa,
  CodeSlashFa,
  EllipsisFa,
  GearFillFa,
  HouseFillFa,
  PaintbrushFillFa,
  PaperplaneFillFa,
  PersonFillFa,
  type FaIconProps,
} from './svg/font-awesome-solid';

export type FaIconComponent = ComponentType<FaIconProps>;

export const ICON_REGISTRY = {
  'house.fill': HouseFillFa,
  'person.fill': PersonFillFa,
  'paperplane.fill': PaperplaneFillFa,
  'chevron.left.forwardslash.chevron.right': CodeSlashFa,
  'chevron.right': ChevronRightFa,
  checklist: ChecklistFa,
  'paintbrush.fill': PaintbrushFillFa,
  ellipsis: EllipsisFa,
  'gearshape.fill': GearFillFa,
} as const satisfies Record<string, FaIconComponent>;

export type IconSymbolName = keyof typeof ICON_REGISTRY;
