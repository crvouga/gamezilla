/**
 * Component dispatch: peel primitives + host call sites.
 *
 * Every convertible always converts (Tier A/B). Non-convertibles are skipped
 * by `transform.ts` — never TODO markers. Dynamic classes use Solid
 * `classList`; opaque sx uses Solid `style` only (no cn / sxStyle helpers).
 */

import type ts from 'typescript';
import { invariant } from './tiger';
import {
  attrExpression,
  attrStringLiteral,
  getJsxAttr,
} from './transform-attrs';
import { convertHost } from './transform-host';
import { isHostConvertible } from './transform-kinds';
import { type ClassListEntry, readExistingClass } from './transform-node';
import { peelPropSpreads } from './transform-peel';
import {
  type ComponentConversion,
  convertBoxLike,
  dataSetFields,
  finish,
  readSxConversion,
} from './transform-shared';
import { convertStack } from './transform-stack';
import { convertText } from './transform-text';

export {
  CONVERTIBLE,
  HOST_CONVERTIBLE,
  isConvertibleExport,
  isHostConvertible,
  isPeelConvertible,
} from './transform-kinds';
export type { ComponentConversion } from './transform-shared';

export function convertBox(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): ComponentConversion {
  return convertBoxLike({
    element,
    source,
    defaultElement: 'div',
    defaultComponent: 'Box',
    baseClass: 'box',
    extras: [],
    extraAttrs: [],
    drops: [],
  });
}

function convertClickable(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): ComponentConversion {
  const peeled = peelPropSpreads(element, source);
  const feedback = readFeedback(element, peeled.feedbackExpr);
  const data = dataSetFields(element, 'Clickable', source, peeled.dataSetExpr);
  const conversion = readSxConversion(element, source, 'sx', peeled.sxExprs);
  return finish({
    conversion,
    element: 'button',
    baseClass: 'clickable',
    extraClasses: feedback.classes,
    extraAttrs:
      getJsxAttr(element, 'type') === undefined ? ['type="button"'] : [],
    dropAttrs: ['feedback', 'dataSet', 'class'],
    dataAttrs: data.dataAttrs,
    dataAttrExprs: data.dataAttrExprs,
    dataAttrsSpread: data.dataAttrsSpread,
    dropSpreadTexts: peeled.dropSpreadTexts,
    existingClass: readExistingClass(element, source),
    classListExtras: feedback.classList,
  });
}

function readFeedback(
  element: ts.JsxOpeningLikeElement,
  peeledExpr: string | undefined
): {
  classes: readonly string[];
  classList: readonly ClassListEntry[];
} {
  if (peeledExpr !== undefined) {
    return { classes: [], classList: feedbackClassList(peeledExpr) };
  }
  const attr = getJsxAttr(element, 'feedback');
  if (attr === undefined) {
    return { classes: ['clickableTint'], classList: [] };
  }
  const literal = attrStringLiteral(attr);
  if (literal === 'opacity') {
    return { classes: ['clickableOpacity'], classList: [] };
  }
  if (literal === 'none') return { classes: [], classList: [] };
  if (literal !== undefined) {
    return { classes: ['clickableTint'], classList: [] };
  }
  const expr = attrExpression(attr);
  if (expr !== undefined) {
    return { classes: [], classList: feedbackClassList(expr.getText()) };
  }
  return { classes: ['clickableTint'], classList: [] };
}

function feedbackClassList(expr: string): readonly ClassListEntry[] {
  return [
    {
      className: 'clickableOpacity',
      when: `String(${expr}) === "opacity"`,
    },
    {
      className: 'clickableTint',
      when: `String(${expr}) !== "opacity" && String(${expr}) !== "none"`,
    },
  ];
}

function convertCenter(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): ComponentConversion {
  return convertBoxLike({
    element,
    source,
    defaultElement: 'div',
    defaultComponent: 'Center',
    baseClass: 'box',
    extras: [
      { prop: 'alignItems', value: 'center' },
      { prop: 'justifyContent', value: 'center' },
    ],
    extraAttrs: [],
    drops: [],
  });
}

function convertSpacer(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): ComponentConversion {
  return convertBoxLike({
    element,
    source,
    defaultElement: 'div',
    defaultComponent: 'Spacer',
    baseClass: 'box',
    extras: [{ prop: 'flex', value: 1 }],
    extraAttrs: ['aria-hidden="true"'],
    drops: [],
  });
}

/** Card → div + `.card` (elevation / border defaults live in hosts.css later). */
function convertCard(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): ComponentConversion {
  return convertBoxLike({
    element,
    source,
    defaultElement: 'div',
    defaultComponent: 'Card',
    baseClass: 'card',
    extras: [],
    extraAttrs: [],
    drops: ['elevation'],
  });
}

/** Divider → div + `.divider` (hairline / orientation CSS later). */
function convertDivider(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): ComponentConversion {
  return convertBoxLike({
    element,
    source,
    defaultElement: 'div',
    defaultComponent: 'Divider',
    baseClass: 'divider',
    extras: [],
    extraAttrs: ['role="separator"'],
    drops: ['orientation'],
  });
}

/**
 * Dispatch on the resolved export name.
 * Hosts may return `undefined` when there is no sx-family prop to rewrite.
 */
export function convertComponent(
  exportName: string,
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): ComponentConversion | undefined {
  if (exportName === 'Box') return convertBox(element, source);
  if (exportName === 'Clickable') return convertClickable(element, source);
  if (exportName === 'Text') return convertText(element, source);
  if (exportName === 'Stack') return convertStack(element, source);
  if (exportName === 'Center') return convertCenter(element, source);
  if (exportName === 'Spacer') return convertSpacer(element, source);
  if (exportName === 'Card') return convertCard(element, source);
  if (exportName === 'Divider') return convertDivider(element, source);
  if (isHostConvertible(exportName)) {
    return convertHost(exportName, element, source);
  }
  invariant(false, `convertComponent called for non-convertible ${exportName}`);
}
