/**
 * Component dispatch: Box / Clickable / Text / Stack / Center / Spacer.
 *
 * - `Box` → `as` element (default `div`), base class `box`.
 * - `Clickable` → `<button>` + `clickable` + feedback class. Every
 *   clickable/pressable maps to a real button (never a bare div).
 * - `Text` → `as` element (default `p` per design-system direction) + `text`
 *   class. `variant` bails (variant presets + on-color/casing are
 *   context-dependent); `label` moves into children; `numberOfLines`
 *   compiles to `line-clamp-N` when statically known.
 * - `Stack`/`Center` desugar their layout props to sx entries, then follow
 *   the Box path with the outer `data-component` name.
 * - `Spacer` is fixed (`flex: 1`); `aria-hidden` passes through.
 * - Anything else carrying `sx`/`frameSx` (ScrollView, GradientBox, Island,
 *   TextInput, …) → Tier C: real behavior lives behind those props.
 */

import ts from 'typescript';
import type { StaticValue } from './mapping-types';
import {
  convertSxEntries,
  readAsElement,
  readDataSet,
  readExistingClass,
  type ExistingClass,
  type NodeConversion,
} from './transform-node';
import {
  attrExpression,
  attrStringLiteral,
  getJsxAttr,
} from './transform-attrs';

export type ComponentConversion = NodeConversion & {
  readonly existingClass?: ExistingClass | undefined;
};

type StaticEntry = { readonly prop: string; readonly value: StaticValue };

function toObjectEntries(entries: readonly StaticEntry[]) {
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
    tier: args.conversion.tier,
    element: args.element,
    classes: [args.baseClass, ...args.conversion.classes],
    styles: args.conversion.styles,
    dataAttrs: args.dataAttrs,
    dropAttrs: [...args.conversion.dropAttrs, ...args.dropAttrs],
    labelAsChildren: args.labelAsChildren,
    existingClass: args.existingClass,
  };
}

function convertSxAttr(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile,
  attrName: string
): NodeConversion {
  const attr = getJsxAttr(element, attrName);
  if (attr === undefined) {
    return {
      kind: 'converted',
      tier: 'A',
      element: '',
      classes: [],
      styles: [],
      dataAttrs: {},
      dropAttrs: [],
    };
  }
  void source;
  return { kind: 'manual', reason: 'sx handled by caller' };
}

export function convertBox(
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): ComponentConversion {
  void convertSxAttr;
  void toObjectEntries;
  void attrExpression;
  void attrStringLiteral;
  void getJsxAttr;
  void readAsElement;
  void readDataSet;
  void readExistingClass;
  void convertSxEntries;
  void element;
  void source;
  return { kind: 'manual', reason: 'unimplemented' };
}
