/**
 * Host call-site conversion: keep the component tag, rewrite sx-family props
 * to Solid class / classList / style (and frame* / enter* / exit* / field*).
 *
 * No peel to HTML — hosts keep behavior. baseClass is omitted (empty).
 */

import type ts from 'typescript';
import { getJsxAttr } from './transform-attrs';
import { tagName } from './transform-collect';
import {
  type ClassListEntry,
  type ExistingClass,
  readExistingClass,
  type StyleEntry,
} from './transform-node';
import { peelPropSpreads } from './transform-peel';
import {
  type ComponentConversion,
  dataSetFields,
  type PrefixedSlot,
  readSxConversion,
} from './transform-shared';

const SX_FAMILY = [
  { attr: 'sx', prefix: '' },
  { attr: 'frameSx', prefix: 'frame' },
  { attr: 'enterSx', prefix: 'enter' },
  { attr: 'exitSx', prefix: 'exit' },
  { attr: 'fieldSx', prefix: 'field' },
] as const;

type SxFamilyAttr = (typeof SX_FAMILY)[number]['attr'];

function peeledExprsFor(
  attr: SxFamilyAttr,
  peeled: ReturnType<typeof peelPropSpreads>
): readonly string[] {
  if (attr === 'sx') return peeled.sxExprs;
  if (attr === 'frameSx') return peeled.frameSxExprs;
  if (attr === 'enterSx') return peeled.enterSxExprs;
  if (attr === 'exitSx') return peeled.exitSxExprs;
  return peeled.fieldSxExprs;
}

function hasSxFamily(
  element: ts.JsxOpeningLikeElement,
  peeled: ReturnType<typeof peelPropSpreads>
): boolean {
  for (const { attr } of SX_FAMILY) {
    if (getJsxAttr(element, attr) !== undefined) return true;
    if (peeledExprsFor(attr, peeled).length > 0) return true;
  }
  return false;
}

function slotFromConversion(args: {
  prefix: string;
  classes: readonly string[];
  styles: readonly StyleEntry[];
  styleExprs: readonly string[];
  classList: readonly ClassListEntry[];
}): PrefixedSlot {
  return {
    prefix: args.prefix,
    classes: args.classes,
    styles: args.styles,
    styleExprs: args.styleExprs,
    classList: args.classList,
  };
}

/**
 * Convert a host opening element. Returns `undefined` when there is nothing
 * to rewrite (no sx / frameSx / enterSx / exitSx / fieldSx).
 */
export function convertHost(
  exportName: string,
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): ComponentConversion | undefined {
  const peeled = peelPropSpreads(element, source);
  if (!hasSxFamily(element, peeled)) return undefined;
  const localTag = tagName(element);
  if (localTag === undefined) return undefined;

  const data = dataSetFields(element, exportName, source, peeled.dataSetExpr);
  const dropAttrs: string[] = ['dataSet', 'class'];
  for (const { attr } of SX_FAMILY) dropAttrs.push(attr);

  let mainClasses: string[] = [];
  let mainStyles: StyleEntry[] = [];
  let mainStyleExprs: string[] = [];
  let mainClassList: ClassListEntry[] = [];
  const prefixedSlots: PrefixedSlot[] = [];
  let tier: 'A' | 'B' = 'A';

  for (const { attr, prefix } of SX_FAMILY) {
    const hasAttr = getJsxAttr(element, attr) !== undefined;
    const peeledExprs = peeledExprsFor(attr, peeled);
    if (!hasAttr && peeledExprs.length === 0) continue;
    const part = readSxConversion(element, source, attr, peeledExprs);
    if (part.tier === 'B') tier = 'B';
    if (prefix === '') {
      mainClasses = [...part.classes];
      mainStyles = [...part.styles];
      mainStyleExprs = [...part.styleExprs];
      mainClassList = [...part.classList];
    } else {
      prefixedSlots.push(
        slotFromConversion({
          prefix,
          classes: part.classes,
          styles: part.styles,
          styleExprs: part.styleExprs,
          classList: part.classList,
        })
      );
    }
  }

  const existingClass: ExistingClass = readExistingClass(element, source);
  if (
    mainStyleExprs.length > 0 ||
    mainClassList.length > 0 ||
    existingClass.kind === 'expr' ||
    prefixedSlots.some((s) => s.styleExprs.length > 0 || s.classList.length > 0)
  ) {
    tier = 'B';
  }

  return {
    kind: 'converted',
    tier,
    element: localTag,
    classes: mainClasses,
    styles: mainStyles,
    styleExprs: mainStyleExprs,
    classList: mainClassList,
    dataAttrs: data.dataAttrs,
    dataAttrExprs: data.dataAttrExprs,
    dataAttrsSpread: data.dataAttrsSpread,
    dropSpreadTexts: peeled.dropSpreadTexts,
    dropAttrs,
    extraAttrs: [],
    existingClass,
    prefixedSlots,
    keepImport: true,
    allowEmptyClass: true,
  };
}
