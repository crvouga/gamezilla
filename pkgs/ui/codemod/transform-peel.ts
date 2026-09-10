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
  const lists: Record<
    'sx' | 'frameSx' | 'enterSx' | 'exitSx' | 'fieldSx',
    string[]
  > = {
    sx: [],
    frameSx: [],
    enterSx: [],
    exitSx: [],
    fieldSx: [],
  };
  const singles: Partial<
    Record<'dataSet' | 'variant' | 'numberOfLines' | 'feedback', string>
  > = {};
  const dropSpreadTexts: string[] = [];
  for (const prop of element.attributes.properties) {
    if (!ts.isJsxSpreadAttribute(prop)) continue;
    const peeled = peelOne(prop.expression, source);
    if (peeled === undefined) continue;
    dropSpreadTexts.push(prop.getText(source));
    if (peeled.prop in lists) {
      lists[peeled.prop as keyof typeof lists].push(peeled.expr);
    } else {
      singles[peeled.prop as keyof typeof singles] = peeled.expr;
    }
  }
  return {
    sxExprs: lists.sx,
    frameSxExprs: lists.frameSx,
    enterSxExprs: lists.enterSx,
    exitSxExprs: lists.exitSx,
    fieldSxExprs: lists.fieldSx,
    dataSetExpr: singles.dataSet,
    variantExpr: singles.variant,
    numberOfLinesExpr: singles.numberOfLines,
    feedbackExpr: singles.feedback,
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
