/**
 * Component dispatch: Box / Clickable / Text / Stack / Center / Spacer.
 *
 * Every convertible always converts (Tier A/B). Non-convertibles are skipped
 * by `transform.ts` — never TODO markers, never Tier C.
 */

import type ts from 'typescript';
import { invariant } from './tiger';
import {
  attrExpression,
  attrStringLiteral,
  getJsxAttr,
} from './transform-attrs';
import { readExistingClass } from './transform-node';
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
    classExtras: feedback.classExtras,
  });
}

function readFeedback(
  element: ts.JsxOpeningLikeElement,
  peeledExpr: string | undefined
): { classes: readonly string[]; classExtras: readonly string[] } {
  if (peeledExpr !== undefined) {
    return { classes: [], classExtras: [feedbackCnExpr(peeledExpr)] };
  }
  const attr = getJsxAttr(element, 'feedback');
  if (attr === undefined) {
    return { classes: ['clickableTint'], classExtras: [] };
  }
  const literal = attrStringLiteral(attr);
  if (literal === 'opacity') {
    return { classes: ['clickableOpacity'], classExtras: [] };
  }
  if (literal === 'none') return { classes: [], classExtras: [] };
  if (literal !== undefined) {
    return { classes: ['clickableTint'], classExtras: [] };
  }
  const expr = attrExpression(attr);
  if (expr !== undefined) {
    return { classes: [], classExtras: [feedbackCnExpr(expr.getText())] };
  }
  return { classes: ['clickableTint'], classExtras: [] };
}

function feedbackCnExpr(expr: string): string {
  return (
    `(${expr}) === "opacity" ? "clickableOpacity" : ` +
    `(${expr}) === "none" ? undefined : "clickableTint"`
  );
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

/** Dispatch on the resolved export name. */
export function convertComponent(
  exportName: string,
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): ComponentConversion {
  if (exportName === 'Box') return convertBox(element, source);
  if (exportName === 'Clickable') return convertClickable(element, source);
  if (exportName === 'Text') return convertText(element, source);
  if (exportName === 'Stack') return convertStack(element, source);
  if (exportName === 'Center') return convertCenter(element, source);
  if (exportName === 'Spacer') return convertSpacer(element, source);
  invariant(false, `convertComponent called for non-convertible ${exportName}`);
}

export const CONVERTIBLE = new Set([
  'Box',
  'Clickable',
  'Text',
  'Stack',
  'Center',
  'Spacer',
]);

export const BEHAVIOR_HOSTS = new Set([
  'ScrollView',
  'GradientBox',
  'Island',
  'TextInput',
  'FocusTrap',
  'JsonView',
  'RelativeTime',
  'BrandIcon',
  'SpinnerBox',
  'MenuList',
  'VirtualList',
  'SpeakingAvatar',
  'CopyToClipboardField',
  'ExampleRoot',
]);
