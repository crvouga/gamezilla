/**
 * Behavior-host conversion: keep the component tag, rewrite sx-shaped
 * attrs to Solid `class` / `classList` / `style` (and content* / field* slots).
 */

import ts from 'typescript';
import { type ClassListEntry, readExistingClass } from './transform-node';
import { peelPropSpreads } from './transform-peel';
import {
  type ComponentConversion,
  finish,
  readSxConversion,
} from './transform-shared';

export type AttrHostSlot =
  | { readonly kind: 'class'; readonly attr: string }
  | {
      readonly kind: 'named';
      readonly attr: string;
      readonly className: string;
      readonly classListName: string;
      readonly styleName: string;
    };

export type AttrHostSpec = {
  readonly slots: readonly AttrHostSlot[];
};

/** Hosts that keep their tag; sx attrs become class/style slots. */
export const ATTR_HOST_SPECS: Readonly<Record<string, AttrHostSpec>> = {
  ScrollView: {
    slots: [
      { kind: 'class', attr: 'frameSx' },
      {
        kind: 'named',
        attr: 'sx',
        className: 'contentClass',
        classListName: 'contentClassList',
        styleName: 'contentStyle',
      },
    ],
  },
  ScreenBodyScrollView: {
    slots: [
      { kind: 'class', attr: 'frameSx' },
      {
        kind: 'named',
        attr: 'sx',
        className: 'contentClass',
        classListName: 'contentClassList',
        styleName: 'contentStyle',
      },
    ],
  },
  ScreenBodyVirtualList: {
    slots: [
      { kind: 'class', attr: 'frameSx' },
      {
        kind: 'named',
        attr: 'sx',
        className: 'contentClass',
        classListName: 'contentClassList',
        styleName: 'contentStyle',
      },
    ],
  },
  VirtualList: {
    slots: [
      { kind: 'class', attr: 'frameSx' },
      {
        kind: 'named',
        attr: 'sx',
        className: 'contentClass',
        classListName: 'contentClassList',
        styleName: 'contentStyle',
      },
    ],
  },
  TextInput: {
    slots: [
      { kind: 'class', attr: 'sx' },
      {
        kind: 'named',
        attr: 'fieldSx',
        className: 'fieldClass',
        classListName: 'fieldClassList',
        styleName: 'fieldStyle',
      },
    ],
  },
  GradientBox: { slots: [{ kind: 'class', attr: 'sx' }] },
  Island: { slots: [{ kind: 'class', attr: 'sx' }] },
  FocusTrap: { slots: [{ kind: 'class', attr: 'sx' }] },
  JsonView: { slots: [{ kind: 'class', attr: 'sx' }] },
  RelativeTime: { slots: [{ kind: 'class', attr: 'sx' }] },
  BrandIcon: { slots: [{ kind: 'class', attr: 'sx' }] },
  SpinnerBox: { slots: [{ kind: 'class', attr: 'sx' }] },
  MenuList: { slots: [{ kind: 'class', attr: 'sx' }] },
  SpeakingAvatar: { slots: [{ kind: 'class', attr: 'sx' }] },
  CopyToClipboardField: { slots: [{ kind: 'class', attr: 'sx' }] },
  ExampleRoot: { slots: [{ kind: 'class', attr: 'sx' }] },
  Card: { slots: [{ kind: 'class', attr: 'sx' }] },
  Divider: { slots: [{ kind: 'class', attr: 'sx' }] },
  Motion: { slots: [{ kind: 'class', attr: 'sx' }] },
  DataTable: { slots: [{ kind: 'class', attr: 'sx' }] },
  CodeEditor: { slots: [{ kind: 'class', attr: 'sx' }] },
};

export const ATTR_HOSTS = new Set(Object.keys(ATTR_HOST_SPECS));

/** Module-tail → export for relative imports of attr hosts inside `@pkgs/ui`. */
export const ATTR_HOST_MODULE_EXPORT: Readonly<Record<string, string>> = {
  'scroll-view': 'ScrollView',
  'virtual-list': 'VirtualList',
  'text-input': 'TextInput',
  'gradient-box': 'GradientBox',
  island: 'Island',
  'focus-trap': 'FocusTrap',
  'json-view': 'JsonView',
  'relative-time': 'RelativeTime',
  'brand-icon': 'BrandIcon',
  'spinner-box': 'SpinnerBox',
  'menu-list': 'MenuList',
  'speaking-avatar': 'SpeakingAvatar',
  'copy-to-clipboard-field': 'CopyToClipboardField',
  'example-root': 'ExampleRoot',
  card: 'Card',
  divider: 'Divider',
  motion: 'Motion',
  'data-table': 'DataTable',
  'code-editor': 'CodeEditor',
};

/**
 * Convert sx-shaped attrs on a kept host tag. Returns undefined when the
 * element has no convertible sx attrs (leave untouched).
 */
export function convertAttrHost(
  exportName: string,
  element: ts.JsxOpeningLikeElement,
  source: ts.SourceFile
): ComponentConversion | undefined {
  const spec = ATTR_HOST_SPECS[exportName];
  if (spec === undefined) return undefined;
  const peeled = peelPropSpreads(element, source);
  const dropAttrs: string[] = [];
  const extraAttrs: string[] = [];
  let classConversion = emptyConversion();
  let hadWork = false;
  for (const slot of spec.slots) {
    const sx = readSxConversion(
      element,
      source,
      slot.attr,
      slot.kind === 'class' && slot.attr === 'sx' ? peeled.sxExprs : []
    );
    const hasSx =
      sx.classes.length > 0 ||
      sx.styles.length > 0 ||
      sx.styleExprs.length > 0 ||
      sx.classList.length > 0 ||
      getAttrPresent(element, slot.attr);
    if (!hasSx) continue;
    hadWork = true;
    dropAttrs.push(slot.attr);
    if (slot.kind === 'class') {
      classConversion = mergeConversions(classConversion, sx);
      continue;
    }
    extraAttrs.push(
      ...emitNamedSlot(slot.className, slot.classListName, slot.styleName, sx)
    );
  }
  if (!hadWork) return undefined;
  dropAttrs.push('class');
  return {
    ...finish({
      conversion: classConversion,
      element: exportName,
      baseClass: '',
      extraClasses: [],
      extraAttrs,
      dropAttrs,
      dataAttrs: {},
      dataAttrExprs: [],
      dropSpreadTexts: peeled.dropSpreadTexts,
      existingClass: readExistingClass(element, source),
    }),
    preserveTag: true,
  };
}

function getAttrPresent(
  element: ts.JsxOpeningLikeElement,
  name: string
): boolean {
  return element.attributes.properties.some(
    (p) =>
      ts.isJsxAttribute(p) && ts.isIdentifier(p.name) && p.name.text === name
  );
}

function emptyConversion(): ReturnType<typeof readSxConversion> {
  return {
    kind: 'converted',
    tier: 'A',
    element: 'div',
    classes: [],
    styles: [],
    styleExprs: [],
    classList: [],
    dataAttrs: {},
    dataAttrExprs: [],
    dropSpreadTexts: [],
    dropAttrs: [],
    extraAttrs: [],
  };
}

function mergeConversions(
  a: ReturnType<typeof readSxConversion>,
  b: ReturnType<typeof readSxConversion>
): ReturnType<typeof readSxConversion> {
  return {
    ...a,
    tier: a.tier === 'B' || b.tier === 'B' ? 'B' : 'A',
    classes: [...a.classes, ...b.classes],
    styles: [...a.styles, ...b.styles],
    styleExprs: [...a.styleExprs, ...b.styleExprs],
    classList: [...a.classList, ...b.classList],
  };
}

function emitNamedSlot(
  className: string,
  classListName: string,
  styleName: string,
  sx: ReturnType<typeof readSxConversion>
): string[] {
  const out: string[] = [];
  if (sx.classes.length > 0) {
    out.push(`${className}=${JSON.stringify(sx.classes.join(' '))}`);
  }
  if (sx.classList.length > 0) {
    out.push(
      `${classListName}={{ ${sx.classList.map(formatClassListEntry).join(', ')} }}`
    );
  }
  const style = namedStyleBinding(sx);
  if (style !== undefined) out.push(`${styleName}=${style}`);
  return out;
}

function formatClassListEntry(e: ClassListEntry): string {
  if ('keyExpr' in e) return `[${e.keyExpr}]: ${e.when}`;
  return `${JSON.stringify(e.className)}: ${e.when}`;
}

function namedStyleBinding(
  sx: ReturnType<typeof readSxConversion>
): string | undefined {
  if (sx.styles.length === 0 && sx.styleExprs.length === 0) return undefined;
  const parts = sx.styles.map((s) => {
    if (s.wrap === 'raw') return `${JSON.stringify(s.cssProp)}: ${s.exprText}`;
    if (s.wrap === 'scaled') {
      return `${JSON.stringify(s.cssProp)}: \`\${(${s.exprText}) * 4}px\``;
    }
    return (
      `${JSON.stringify(s.cssProp)}: (typeof (${s.exprText}) === "number" ` +
      `? \`${'${'}(${s.exprText})}px\` : (${s.exprText}))`
    );
  });
  if (
    parts.length === 0 &&
    sx.styleExprs.length === 1 &&
    !sx.styleExprs[0]?.trim().startsWith('{')
  ) {
    return `{${sx.styleExprs[0]}}`;
  }
  const merges = sx.styleExprs.map((e) => {
    const t = e.trim();
    if (t.startsWith('{') && t.endsWith('}')) {
      const inner = t.slice(1, -1).trim();
      return inner.length > 0 ? inner : '';
    }
    return `...((${e}) ?? {})`;
  });
  return `{{ ${[...merges.filter(Boolean), ...parts].join(', ')} }}`;
}
