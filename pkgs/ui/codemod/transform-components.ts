/**
 * Component dispatch: Box / Clickable / Text / Stack / Center / Spacer.
 *
 * - `Box` → `as` element (default `div`), base class `box`.
 * - `Clickable` → `<button>` + `clickable` + feedback class. Every
 *   clickable/pressable maps to a real button (never a bare div).
 * - `Text` → `as` element (default `p` per design-system direction) + `text`
 *   class. `variant` bails (presets + on-color/casing are context-dependent);
 *   `label` moves into children; static `numberOfLines` → `line-clamp-N`.
 * - `Stack`/`Center` desugar layout props to sx entries, then follow the Box
 *   path with the outer `data-component` name.
 * - `Spacer` is fixed (`flex: 1`); `aria-hidden` passes through.
 * - Anything else carrying `sx`/`frameSx` (ScrollView, GradientBox, Island,
 *   TextInput, …) → Tier C: real behavior lives behind those props.
 */

import ts from 'typescript';
import type { StaticValue } from './mapping-types';
import { invariant } from './tiger';
import {
  attrExpression,
  attrStringLiteral,
  getJsxAttr,
  type ObjectEntry,
} from './transform-attrs';
import {
  convertSxEntries,
  convertSxParts,
  type ExistingClass,
  type NodeConversion,
  readAsElement,
  readDataSet,
  readExistingClass,
  readSxAttr,
  toDataAttrs,
} from './transform-node';

export type ComponentConversion = NodeConversion & {
  readonly existingClass?: ExistingClass | undefined;
};

type ExtraEntry = { readonly prop: string; readonly value: StaticValue };

function staticEntries(entries: readonly ExtraEntry[]): ObjectEntry[] {
  return entries.map((e) => ({
    prop: e.prop,
    value: { kind: 'static', value: e.value } as const,
    raw: undefined as never,
  }));
}

function finish(args: {
  conversion: NodeConversion;
  element: string;
  baseClass: string;
  extraClasses: readonly string[];
  extraAttrs: readonly string[];
  dropAttrs: readonly string[];
  dataAttrs: Readonly<Record<string, string>>;
  labelAsChildren?: string | undefined;
  existingClass: ExistingClass | undefined;
}): ComponentConversion {
  if (args.conversion.kind === 'manual') return args.conversion;
  if (args.existingClass === undefined) {
    return { kind: 'manual', reason: 'class is a template expression' };
  }
  return {
    kind: 'converted',
    tier:
      args.conversion.tier === 'B' || args.conversion.cnExprs.length > 0
        ? 'B'
        : 'A',
    element: args.element,
    classes: [args.baseClass, ...args.extraClasses, ...args.conversion.classes],
    styles: args.conversion.styles,
    cnExprs: args.conversion.cnExprs,
    dataAttrs: args.dataAttrs,
    dropAttrs: [...args.conversion.dropAttrs, ...args.dropAttrs],
    extraAttrs: args.extraAttrs,
    labelAsChildren: args.labelAsChildren,
    existingClass: args.existingClass,
  };
}

function withExtra(
  conversion: NodeConversion,
  extras: readonly ExtraEntry[],
  source: ts.SourceFile
): NodeConversion {
  if (conversion.kind === 'manual' || extras.length === 0) return conversion;
  const extra = convertSxEntries(staticEntries(extras), source);
  if (extra.kind === 'manual') return extra;
  return {
    ...conversion,
    tier: extra.tier === 'B' || conversion.tier === 'B' ? 'B' : 'A',
    classes: [...extra.classes, ...conversion.classes],
    styles: [...extra.styles, ...conversion.styles],
    cnExprs: [...extra.cnExprs, ...conversion.cnExprs],
  };
}

function readSxConversion(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile,
  attrName: string
): NodeConversion {
  const sx = readSxAttr(element, source, attrName);
  if (sx.kind === 'splices') return convertSxParts(sx.parts, source);
  const entries = sx.kind === 'record' ? sx.entries : [];
  return convertSxEntries(entries, source);
}

function convertBoxLike(args: {
  element: ts.JsxOpeningLikeElement;
  source: ts.SourceFile;
  defaultElement: string;
  defaultComponent: string;
  baseClass: string;
  extras: readonly ExtraEntry[];
  extraAttrs: readonly string[];
  drops: readonly string[];
}): ComponentConversion {
  const { element, source } = args;
  const asElement = readAsElement(element, args.defaultElement);
  if (asElement === undefined) {
    return { kind: 'manual', reason: 'as is not a string literal' };
  }
  const dataSet = readDataSet(element, args.defaultComponent);
  if (dataSet.kind === 'manual') return dataSet;
  const conversion = withExtra(
    readSxConversion(element, source, 'sx'),
    args.extras,
    source
  );
  return finish({
    conversion,
    element: asElement,
    baseClass: args.baseClass,
    extraClasses: [],
    extraAttrs: args.extraAttrs,
    dropAttrs: [...args.drops, 'as', 'dataSet', 'class'],
    dataAttrs: toDataAttrs(dataSet.attrs),
    existingClass: readExistingClass(element, source),
  });
}

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
  const feedback = readFeedback(element);
  if (feedback === undefined) {
    return { kind: 'manual', reason: 'feedback is not a string literal' };
  }
  if (
    feedback !== null &&
    feedback !== 'tint' &&
    feedback !== 'opacity' &&
    feedback !== 'none'
  ) {
    return { kind: 'manual', reason: `unknown feedback ${feedback}` };
  }
  const dataSet = readDataSet(element, 'Clickable');
  if (dataSet.kind === 'manual') return dataSet;
  const conversion = readSxConversion(element, source, 'sx');
  return finish({
    conversion,
    element: 'button',
    baseClass: 'clickable',
    extraClasses: feedbackClasses(feedback),
    extraAttrs:
      getJsxAttr(element, 'type') === undefined ? ['type="button"'] : [],
    dropAttrs: ['feedback', 'dataSet', 'class'],
    dataAttrs: toDataAttrs(dataSet.attrs),
    existingClass: readExistingClass(element, source),
  });
}

function readFeedback(
  element: ts.JsxOpeningLikeElement
): string | null | undefined {
  const attr = getJsxAttr(element, 'feedback');
  if (attr === undefined) return null;
  const literal = attrStringLiteral(attr);
  if (literal !== undefined) return literal;
  return undefined;
}

/** Default + `tint` layer the translucent overlay; `none` adds no class. */
function feedbackClasses(feedback: string | null): readonly string[] {
  if (feedback === 'opacity') return ['clickableOpacity'];
  if (feedback === 'none') return [];
  return ['clickableTint'];
}

function convertText(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): ComponentConversion {
  if (getJsxAttr(element, 'variant') !== undefined) {
    return { kind: 'manual', reason: 'Text variant needs context expansion' };
  }
  const asElement = readAsElement(element, 'p');
  if (asElement === undefined) {
    return { kind: 'manual', reason: 'as is not a string literal' };
  }
  const dataSet = readDataSet(element, 'Text');
  if (dataSet.kind === 'manual') return dataSet;
  const lines = readNumberOfLines(element);
  if (lines === undefined) {
    return { kind: 'manual', reason: 'numberOfLines is not static' };
  }
  const sxConversion = readSxConversion(element, source, 'sx');
  const conversion = withExtra(sxConversion, lines, source);
  return finish({
    conversion,
    element: asElement,
    baseClass: 'text',
    extraClasses: [],
    extraAttrs: [],
    dropAttrs: ['as', 'dataSet', 'label', 'numberOfLines'],
    dataAttrs: toDataAttrs(dataSet.attrs),
    labelAsChildren: readLabelAsChildren(element, source),
    existingClass: readExistingClass(element, source),
  });
}

function readNumberOfLines(
  element: ts.JsxOpeningLikeElement
): readonly ExtraEntry[] | undefined {
  const attr = getJsxAttr(element, 'numberOfLines');
  if (attr === undefined) return [];
  const literal = attrStringLiteral(attr);
  if (literal !== undefined) return [];
  const expr = attrExpression(attr);
  if (expr === undefined || !ts.isNumericLiteral(expr)) return undefined;
  const n = Number(expr.text);
  if (!Number.isInteger(n) || n < 0) return undefined;
  return [{ prop: 'lineClamp', value: n }];
}

/** `label` renders as children at runtime — move it into children. */
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

function convertStack(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): ComponentConversion {
  const layout = readStackLayout(element);
  if (layout === undefined) {
    return { kind: 'manual', reason: 'Stack layout prop is dynamic' };
  }
  return convertBoxLike({
    element,
    source,
    defaultElement: 'div',
    defaultComponent: 'Stack',
    baseClass: 'box',
    extras: layout,
    extraAttrs: [],
    drops: ['direction', 'spacing', 'align', 'justify', 'wrap'],
  });
}

function readStackLayout(
  element: ts.JsxOpeningLikeElement
): readonly ExtraEntry[] | undefined {
  const out: ExtraEntry[] = [];
  const direction = readLayoutString(element, 'direction');
  if (direction === undefined) return undefined;
  const axis = direction ?? 'vertical';
  if (axis !== 'vertical' && axis !== 'horizontal') return undefined;
  out.push({
    prop: 'flexDirection',
    value: axis === 'horizontal' ? 'row' : 'column',
  });
  const spacing = readLayoutNumber(element, 'spacing');
  if (spacing === undefined) return undefined;
  if (spacing !== null) out.push({ prop: 'gap', value: spacing });
  const align = readLayoutString(element, 'align');
  if (align === undefined) return undefined;
  if (align !== null) out.push({ prop: 'alignItems', value: align });
  const justify = readLayoutString(element, 'justify');
  if (justify === undefined) return undefined;
  if (justify !== null) out.push({ prop: 'justifyContent', value: justify });
  const wrap = readLayoutWrap(element);
  if (wrap === undefined) return undefined;
  if (wrap) out.push({ prop: 'flexWrap', value: 'wrap' });
  return out;
}

function readLayoutString(
  element: ts.JsxOpeningLikeElement,
  name: string
): string | null | undefined {
  const attr = getJsxAttr(element, name);
  if (attr === undefined) return null;
  const literal = attrStringLiteral(attr);
  if (literal !== undefined) return literal;
  const expr = attrExpression(attr);
  if (expr !== undefined && ts.isStringLiteral(expr)) return expr.text;
  return undefined;
}

function readLayoutNumber(
  element: ts.JsxOpeningLikeElement,
  name: string
): number | null | undefined {
  const attr = getJsxAttr(element, name);
  if (attr === undefined) return null;
  const expr = attrExpression(attr);
  if (expr !== undefined && ts.isNumericLiteral(expr)) {
    const n = Number(expr.text);
    invariant(Number.isFinite(n), `Stack spacing is not finite`);
    return n;
  }
  return undefined;
}

function readLayoutWrap(
  element: ts.JsxOpeningLikeElement
): boolean | undefined {
  const attr = getJsxAttr(element, 'wrap');
  if (attr === undefined) return false;
  if (attr.initializer === undefined) return true;
  const expr = attrExpression(attr);
  if (expr === undefined) return undefined;
  if (expr.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expr.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
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
  if (getJsxAttr(element, 'sx') !== undefined) {
    return { kind: 'manual', reason: 'Spacer drops sx at runtime' };
  }
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

/** Dispatch on the resolved export name; behavior hosts → Tier C. */
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
  return {
    kind: 'manual',
    reason: `${exportName} has behavior beyond styling`,
  };
}

/** Export names the codemod can resolve from `@pkgs/ui` imports. */
export const CONVERTIBLE = new Set([
  'Box',
  'Clickable',
  'Text',
  'Stack',
  'Center',
  'Spacer',
]);

/** Known behavior hosts: tagged Tier C only when they carry sx/frameSx. */
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
