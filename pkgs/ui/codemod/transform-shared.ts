/**
 * Shared conversion helpers for Box-like hosts (finish, sx merge, dataSet).
 */

import type ts from 'typescript';
import type { StaticValue } from './mapping-types';
import type { ObjectEntry } from './transform-attrs';
import { convertDataSet, emitDataSetAttrs } from './transform-dataset';
import {
  convertSxEntries,
  convertSxParts,
  type ExistingClass,
  type NodeConversion,
  readAsElement,
  readExistingClass,
  readSxAttr,
} from './transform-node';
import { peelPropSpreads } from './transform-peel';

export type ComponentConversion = NodeConversion & {
  readonly existingClass?: ExistingClass | undefined;
};

export type ExtraEntry = {
  readonly prop: string;
  readonly value: StaticValue;
};

function staticEntries(entries: readonly ExtraEntry[]): ObjectEntry[] {
  return entries.map((e) => ({
    prop: e.prop,
    value: { kind: 'static', value: e.value } as const,
    raw: undefined as never,
  }));
}

export function finish(args: {
  conversion: NodeConversion;
  element: string;
  baseClass: string;
  extraClasses: readonly string[];
  extraAttrs: readonly string[];
  dropAttrs: readonly string[];
  dataAttrs: Readonly<Record<string, string>>;
  dataAttrExprs: readonly string[];
  dataAttrsSpread?: string | undefined;
  dropSpreadTexts: readonly string[];
  labelAsChildren?: string | undefined;
  existingClass: ExistingClass;
  cnExtras?: readonly string[] | undefined;
  classExtras?: readonly string[] | undefined;
}): ComponentConversion {
  const cnExprs = [...args.conversion.cnExprs, ...(args.cnExtras ?? [])];
  const classExprs = [
    ...args.conversion.classExprs,
    ...(args.classExtras ?? []),
  ];
  return {
    kind: 'converted',
    tier:
      args.conversion.tier === 'B' ||
      cnExprs.length > 0 ||
      classExprs.length > 0
        ? 'B'
        : 'A',
    element: args.element,
    classes: [args.baseClass, ...args.extraClasses, ...args.conversion.classes],
    styles: args.conversion.styles,
    cnExprs,
    classExprs,
    dataAttrs: args.dataAttrs,
    dataAttrExprs: args.dataAttrExprs,
    dataAttrsSpread: args.dataAttrsSpread,
    dropSpreadTexts: args.dropSpreadTexts,
    dropAttrs: [...args.conversion.dropAttrs, ...args.dropAttrs],
    extraAttrs: args.extraAttrs,
    labelAsChildren: args.labelAsChildren,
    existingClass: args.existingClass,
  };
}

export function withExtra(
  conversion: NodeConversion,
  extras: readonly ExtraEntry[],
  source: ts.SourceFile
): NodeConversion {
  if (extras.length === 0) return conversion;
  const extra = convertSxEntries(staticEntries(extras), source);
  return {
    ...conversion,
    tier: extra.tier === 'B' || conversion.tier === 'B' ? 'B' : 'A',
    classes: [...extra.classes, ...conversion.classes],
    styles: [...extra.styles, ...conversion.styles],
    cnExprs: [...extra.cnExprs, ...conversion.cnExprs],
  };
}

export function readSxConversion(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile,
  attrName: string,
  peeledSx: readonly string[]
): NodeConversion {
  const sx = readSxAttr(element, source, attrName);
  let conversion: NodeConversion;
  if (sx.kind === 'splices') conversion = convertSxParts(sx.parts, source);
  else {
    const entries = sx.kind === 'record' ? sx.entries : [];
    conversion = convertSxEntries(entries, source);
  }
  if (peeledSx.length === 0) return conversion;
  return {
    ...conversion,
    tier: 'B',
    cnExprs: [...conversion.cnExprs, ...peeledSx],
  };
}

export function dataSetFields(
  element: ts.JsxOpeningLikeElement,
  defaultComponent: string,
  source: ts.SourceFile,
  peeledDataSetExpr: string | undefined
): {
  dataAttrs: Readonly<Record<string, string>>;
  dataAttrExprs: readonly string[];
  dataAttrsSpread?: string | undefined;
} {
  return emitDataSetAttrs(
    convertDataSet(element, defaultComponent, source, peeledDataSetExpr)
  );
}

export function convertBoxLike(args: {
  element: ts.JsxOpeningLikeElement;
  source: ts.SourceFile;
  defaultElement: string;
  defaultComponent: string;
  baseClass: string;
  extras: readonly ExtraEntry[];
  extraAttrs: readonly string[];
  drops: readonly string[];
  cnExtras?: readonly string[] | undefined;
}): ComponentConversion {
  const { element, source } = args;
  const peeled = peelPropSpreads(element, source);
  const asElement = readAsElement(element, args.defaultElement);
  const data = dataSetFields(
    element,
    args.defaultComponent,
    source,
    peeled.dataSetExpr
  );
  const conversion = withExtra(
    readSxConversion(element, source, 'sx', peeled.sxExprs),
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
    dataAttrs: data.dataAttrs,
    dataAttrExprs: data.dataAttrExprs,
    dataAttrsSpread: data.dataAttrsSpread,
    dropSpreadTexts: peeled.dropSpreadTexts,
    existingClass: readExistingClass(element, source),
    cnExtras: args.cnExtras,
  });
}
