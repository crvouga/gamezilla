/**
 * Text → semantic host + `.text*` global classes (or classList for dynamics).
 */

import ts from 'typescript';
import {
  attrExpression,
  attrStringLiteral,
  getJsxAttr,
} from './transform-attrs';
import type { ClassListEntry } from './transform-node';
import { readAsElement, readExistingClass } from './transform-node';
import { peelPropSpreads } from './transform-peel';
import type { ComponentConversion, ExtraEntry } from './transform-shared';
import {
  dataSetFields,
  finish,
  readSxConversion,
  withExtra,
} from './transform-shared';

const TEXT_VARIANT_HOST: Readonly<
  Record<string, { readonly element: string; readonly className?: string }>
> = {
  body: { element: 'p' },
  bodyBold: { element: 'p', className: 'textBodyBold' },
  caption: { element: 'p', className: 'textCaption' },
  label: { element: 'label', className: 'textLabel' },
  title: { element: 'h1', className: 'textTitle' },
  subtitle: { element: 'h2', className: 'textSubtitle' },
  heading: { element: 'h3', className: 'textHeading' },
  navigationTitle: { element: 'h2', className: 'textNavigationTitle' },
  link: { element: 'p', className: 'textLink' },
  mono: { element: 'code', className: 'textMono' },
};

export function convertText(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): ComponentConversion {
  const peeled = peelPropSpreads(element, source);
  const variant = resolveTextVariant(element, peeled.variantExpr);
  const asElement = readAsElement(element, variant.element);
  const data = dataSetFields(element, 'Text', source, peeled.dataSetExpr);
  const lines = readNumberOfLines(element, peeled.numberOfLinesExpr);
  const sxConversion = readSxConversion(element, source, 'sx', peeled.sxExprs);
  const conversion = withExtra(sxConversion, lines.extras, source);
  return finish({
    conversion,
    element: asElement,
    baseClass: 'text',
    extraClasses: variant.extraClasses,
    extraAttrs: [],
    dropAttrs: ['as', 'class', 'dataSet', 'label', 'numberOfLines', 'variant'],
    dataAttrs: data.dataAttrs,
    dataAttrExprs: data.dataAttrExprs,
    dataAttrsSpread: data.dataAttrsSpread,
    dropSpreadTexts: peeled.dropSpreadTexts,
    labelAsChildren: readLabelAsChildren(element, source),
    existingClass: readExistingClass(element, source),
    classListExtras: variant.classList,
    styleExtras: lines.styleExtras,
  });
}

function resolveTextVariant(
  element: ts.JsxOpeningLikeElement,
  peeledExpr: string | undefined
): {
  element: string;
  extraClasses: readonly string[];
  classList: readonly ClassListEntry[];
} {
  if (peeledExpr !== undefined) {
    return {
      element: 'p',
      extraClasses: [],
      classList: variantClassList(peeledExpr),
    };
  }
  const attr = getJsxAttr(element, 'variant');
  if (attr === undefined) {
    return { element: 'p', extraClasses: [], classList: [] };
  }
  let name = attrStringLiteral(attr);
  if (name === undefined) {
    const expr = attrExpression(attr);
    if (expr !== undefined && ts.isStringLiteral(expr)) name = expr.text;
    else if (expr !== undefined) {
      return {
        element: 'p',
        extraClasses: [],
        classList: variantClassList(expr.getText()),
      };
    }
  }
  if (name === undefined) {
    return { element: 'p', extraClasses: [], classList: [] };
  }
  const host = TEXT_VARIANT_HOST[name];
  if (host === undefined) {
    return { element: 'p', extraClasses: [], classList: [] };
  }
  return {
    element: host.element,
    extraClasses: host.className === undefined ? [] : [host.className],
    classList: [],
  };
}

/**
 * Every non-body variant class toggled from a dynamic variant expression.
 * `String(...)` avoids TS2367 (narrow-union comparisons) and `?? "body"`
 * (TS2869 unreachable) — `body` has no class, so an unmatched value is a no-op.
 */
function variantClassList(expr: string): readonly ClassListEntry[] {
  const out: ClassListEntry[] = [];
  for (const name of Object.keys(TEXT_VARIANT_HOST)) {
    const host = TEXT_VARIANT_HOST[name];
    if (host?.className === undefined) continue;
    out.push({
      className: host.className,
      when: `String(${expr}) === ${JSON.stringify(name)}`,
    });
  }
  return out;
}

function readNumberOfLines(
  element: ts.JsxOpeningLikeElement,
  peeledExpr: string | undefined
): { extras: readonly ExtraEntry[]; styleExtras: readonly string[] } {
  if (peeledExpr !== undefined) {
    return { extras: [], styleExtras: [lineClampStyle(peeledExpr)] };
  }
  const attr = getJsxAttr(element, 'numberOfLines');
  if (attr === undefined) return { extras: [], styleExtras: [] };
  const literal = attrStringLiteral(attr);
  if (literal !== undefined) return { extras: [], styleExtras: [] };
  const expr = attrExpression(attr);
  if (expr === undefined) return { extras: [], styleExtras: [] };
  if (ts.isNumericLiteral(expr)) {
    const n = Number(expr.text);
    if (!Number.isInteger(n) || n < 0) return { extras: [], styleExtras: [] };
    return { extras: [{ prop: 'lineClamp', value: n }], styleExtras: [] };
  }
  return {
    extras: [],
    styleExtras: [lineClampStyle(expr.getText())],
  };
}

/**
 * Solid `style` object for a dynamic `numberOfLines`. Uses dash-case CSS keys
 * (Solid's `CSSProperties` rejects camelCase `lineClamp`) and the
 * `-webkit-line-clamp` box so the clamp actually renders.
 */
function lineClampStyle(expr: string): string {
  return (
    `{ display: '-webkit-box', '-webkit-box-orient': 'vertical', ` +
    `'-webkit-line-clamp': ${expr}, overflow: 'hidden' }`
  );
}

function readLabelAsChildren(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): string | undefined {
  const attr = getJsxAttr(element, 'label');
  if (attr === undefined) return undefined;
  const literal = attrStringLiteral(attr);
  if (literal !== undefined) return JSON.stringify(literal);
  const expr = attrExpression(attr);
  if (expr === undefined) return undefined;
  return expr.getText(source);
}
