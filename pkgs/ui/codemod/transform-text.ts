/**
 * Text → semantic host + `.text*` global classes (or TEXT_VARIANT_CLASS).
 */

import ts from 'typescript';
import {
  attrExpression,
  attrStringLiteral,
  getJsxAttr,
} from './transform-attrs';
import { readAsElement, readExistingClass } from './transform-node';
import { peelPropSpreads } from './transform-peel';
import {
  type ComponentConversion,
  dataSetFields,
  type ExtraEntry,
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
    dropAttrs: ['as', 'dataSet', 'label', 'numberOfLines', 'variant'],
    dataAttrs: data.dataAttrs,
    dataAttrExprs: data.dataAttrExprs,
    dataAttrsSpread: data.dataAttrsSpread,
    dropSpreadTexts: peeled.dropSpreadTexts,
    labelAsChildren: readLabelAsChildren(element, source),
    existingClass: readExistingClass(element, source),
    classExtras: variant.classExtras,
    cnExtras: lines.cnExtras,
  });
}

function resolveTextVariant(
  element: ts.JsxOpeningLikeElement,
  peeledExpr: string | undefined
): {
  element: string;
  extraClasses: readonly string[];
  classExtras: readonly string[];
} {
  if (peeledExpr !== undefined) {
    return {
      element: 'p',
      extraClasses: [],
      classExtras: [`TEXT_VARIANT_CLASS[(${peeledExpr}) ?? "body"]`],
    };
  }
  const attr = getJsxAttr(element, 'variant');
  if (attr === undefined) {
    return { element: 'p', extraClasses: [], classExtras: [] };
  }
  let name = attrStringLiteral(attr);
  if (name === undefined) {
    const expr = attrExpression(attr);
    if (expr !== undefined && ts.isStringLiteral(expr)) name = expr.text;
    else if (expr !== undefined) {
      return {
        element: 'p',
        extraClasses: [],
        classExtras: [`TEXT_VARIANT_CLASS[(${expr.getText()}) ?? "body"]`],
      };
    }
  }
  if (name === undefined) {
    return { element: 'p', extraClasses: [], classExtras: [] };
  }
  const host = TEXT_VARIANT_HOST[name];
  if (host === undefined) {
    return { element: 'p', extraClasses: [], classExtras: [] };
  }
  return {
    element: host.element,
    extraClasses: host.className === undefined ? [] : [host.className],
    classExtras: [],
  };
}

function readNumberOfLines(
  element: ts.JsxOpeningLikeElement,
  peeledExpr: string | undefined
): { extras: readonly ExtraEntry[]; cnExtras: readonly string[] } {
  if (peeledExpr !== undefined) {
    return { extras: [], cnExtras: [`{ lineClamp: ${peeledExpr} }`] };
  }
  const attr = getJsxAttr(element, 'numberOfLines');
  if (attr === undefined) return { extras: [], cnExtras: [] };
  const literal = attrStringLiteral(attr);
  if (literal !== undefined) return { extras: [], cnExtras: [] };
  const expr = attrExpression(attr);
  if (expr === undefined) return { extras: [], cnExtras: [] };
  if (ts.isNumericLiteral(expr)) {
    const n = Number(expr.text);
    if (!Number.isInteger(n) || n < 0) return { extras: [], cnExtras: [] };
    return { extras: [{ prop: 'lineClamp', value: n }], cnExtras: [] };
  }
  return { extras: [], cnExtras: [`{ lineClamp: ${expr.getText()} }`] };
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
