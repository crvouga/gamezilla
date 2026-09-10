/**
 * Peel conditional prop-object spreads (`{...(x ? { sx: x } : {})}`) into
 * conversion inputs so converted hosts never leak `sx`/`dataSet`/`variant`.
 */

import ts from 'typescript';

export type PeeledSpreads = {
  readonly sxExprs: readonly string[];
  readonly frameSxExprs: readonly string[];
  readonly enterSxExprs: readonly string[];
  readonly exitSxExprs: readonly string[];
  readonly fieldSxExprs: readonly string[];
  readonly dataSetExpr?: string | undefined;
  readonly variantExpr?: string | undefined;
  readonly numberOfLinesExpr?: string | undefined;
  readonly feedbackExpr?: string | undefined;
  /** Exact `getText` of spreads consumed (omit from passthrough). */
  readonly dropSpreadTexts: readonly string[];
};

const PEELABLE = new Set([
  'sx',
  'frameSx',
  'enterSx',
  'exitSx',
  'fieldSx',
  'dataSet',
  'variant',
  'numberOfLines',
  'feedback',
]);

/** Extract known props from conditional object spreads on a JSX opening. */
export function peelPropSpreads(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): PeeledSpreads {
  const sxExprs: string[] = [];
  const frameSxExprs: string[] = [];
  const enterSxExprs: string[] = [];
  const exitSxExprs: string[] = [];
  const fieldSxExprs: string[] = [];
  const dropSpreadTexts: string[] = [];
  let dataSetExpr: string | undefined;
  let variantExpr: string | undefined;
  let numberOfLinesExpr: string | undefined;
  let feedbackExpr: string | undefined;
  for (const prop of element.attributes.properties) {
    if (!ts.isJsxSpreadAttribute(prop)) continue;
    const peeled = peelOne(prop.expression, source);
    if (peeled === undefined) continue;
    dropSpreadTexts.push(prop.getText(source));
    if (peeled.prop === 'sx') sxExprs.push(peeled.expr);
    else if (peeled.prop === 'frameSx') frameSxExprs.push(peeled.expr);
    else if (peeled.prop === 'enterSx') enterSxExprs.push(peeled.expr);
    else if (peeled.prop === 'exitSx') exitSxExprs.push(peeled.expr);
    else if (peeled.prop === 'fieldSx') fieldSxExprs.push(peeled.expr);
    else if (peeled.prop === 'dataSet') dataSetExpr = peeled.expr;
    else if (peeled.prop === 'variant') variantExpr = peeled.expr;
    else if (peeled.prop === 'numberOfLines') numberOfLinesExpr = peeled.expr;
    else if (peeled.prop === 'feedback') feedbackExpr = peeled.expr;
  }
  return {
    sxExprs,
    frameSxExprs,
    enterSxExprs,
    exitSxExprs,
    fieldSxExprs,
    dataSetExpr,
    variantExpr,
    numberOfLinesExpr,
    feedbackExpr,
    dropSpreadTexts,
  };
}

function peelOne(
  expr: ts.Expression,
  source: ts.SourceFile
): { readonly prop: string; readonly expr: string } | undefined {
  if (!ts.isParenthesizedExpression(expr)) {
    return peelConditional(expr, source);
  }
  return peelConditional(expr.expression, source);
}

function peelConditional(
  expr: ts.Expression,
  source: ts.SourceFile
): { readonly prop: string; readonly expr: string } | undefined {
  if (!ts.isConditionalExpression(expr)) return undefined;
  const emptyFalse =
    ts.isObjectLiteralExpression(expr.whenFalse) &&
    expr.whenFalse.properties.length === 0;
  if (!emptyFalse || !ts.isObjectLiteralExpression(expr.whenTrue)) {
    return undefined;
  }
  if (expr.whenTrue.properties.length !== 1) return undefined;
  const member = expr.whenTrue.properties[0];
  if (member === undefined || !ts.isPropertyAssignment(member))
    return undefined;
  const key =
    ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)
      ? member.name.text
      : undefined;
  if (key === undefined || !PEELABLE.has(key)) return undefined;
  return { prop: key, expr: member.initializer.getText(source) };
}
