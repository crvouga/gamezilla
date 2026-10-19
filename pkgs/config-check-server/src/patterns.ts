/**
 * The forbidden patterns of each package kind, read straight from syntax.
 *
 * This is the second, independent reading behind `verify:patterns`: it parses
 * a package's own files and nothing else, uses no type information, honors no
 * comment, and shares no rule list with the lint presets. A lint preset that
 * is weakened, or a directive that silences it, leaves every finding here.
 *
 * Pure over the given texts.
 */

import ts from 'typescript';
import type { PackageKind } from './package-kind';
import { isComposer } from './package-kind';
import {
  AMBIGUOUS_HEX,
  COLOR_FUNCTION,
  COMBINED_COMPONENT,
  CSS_IN_JS_TAGS,
  DEEP_WORKSPACE_IMPORT,
  DURATION,
  EASING,
  FONT_NAME,
  GENERIC_FONT,
  GLOBAL_OBJECTS,
  HEX_COLOR,
  LENGTH,
  MARGIN_CLASS,
  MARGIN_DECLARATION,
  MEDIA_QUERY,
  OPEN_STYLE_PROP,
  PERCENT,
  PLATFORM_GLOBALS,
  PLATFORM_IMPORT,
  STYLE_ATTRIBUTES,
  STYLE_IMPORT,
  SUPPRESSION,
  THIRD_PARTY_UI,
  UTILITY_CLASS,
  UTILITY_COMPANION,
  VISUAL_PROP,
  Z_INDEX_NAMES,
} from './pattern-vocabulary';

export type PatternSource = { readonly path: string; readonly text: string };

export type PatternViolation = {
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly rule: string;
  readonly message: string;
};

const SCRIPT_FILE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const STYLE_FILE = /\.(css|scss|sass|less|styl|pcss)$/;
const MARKUP_FILE = /\.(html|htm|svg)$/;

type Report = (pos: number, rule: string, message: string) => void;

function scriptKind(path: string): ts.ScriptKind {
  if (/\.(tsx|jsx)$/.test(path)) return ts.ScriptKind.TSX;
  if (/\.(js|mjs|cjs)$/.test(path)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/** Every name the file binds; a use of one of them is not the global. */
function declaredNames(file: ts.SourceFile): ReadonlySet<string> {
  const names = new Set<string>();
  function bind(name: ts.Node | undefined): void {
    if (name === undefined) return;
    if (ts.isIdentifier(name)) names.add(name.text);
    else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name))
      for (const element of name.elements)
        if (ts.isBindingElement(element)) bind(element.name);
  }
  function visit(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isModuleDeclaration(node) ||
      ts.isTypeParameterDeclaration(node) ||
      ts.isImportClause(node) ||
      ts.isImportSpecifier(node) ||
      ts.isNamespaceImport(node) ||
      ts.isImportEqualsDeclaration(node) ||
      ts.isBindingElement(node)
    )
      bind(node.name);
    ts.forEachChild(node, visit);
  }
  visit(file);
  return names;
}

/** Whether `node` names a value or type, rather than a member or a label. */
function isReference(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent)) return parent.expression === node;
  if (ts.isQualifiedName(parent)) return parent.left === node;
  if (ts.isLabeledStatement(parent) || ts.isBreakOrContinueStatement(parent))
    return false;
  if (
    ts.isPropertyAssignment(parent) ||
    ts.isPropertySignature(parent) ||
    ts.isPropertyDeclaration(parent) ||
    ts.isMethodDeclaration(parent) ||
    ts.isMethodSignature(parent) ||
    ts.isGetAccessorDeclaration(parent) ||
    ts.isSetAccessorDeclaration(parent) ||
    ts.isEnumMember(parent) ||
    ts.isJsxAttribute(parent) ||
    ts.isNamedTupleMember(parent)
  )
    return parent.name !== node;
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent))
    return false;
  if (ts.isBindingElement(parent)) return parent.propertyName !== node;
  return true;
}

function jsxName(name: ts.JsxAttributeName): {
  readonly namespace: string | undefined;
  readonly local: string;
} {
  if (ts.isJsxNamespacedName(name))
    return { namespace: name.namespace.text, local: name.name.text };
  return { namespace: undefined, local: name.text };
}

function isIntrinsicTag(tag: ts.JsxTagNameExpression): boolean {
  if (ts.isIdentifier(tag)) return /^[a-z]/.test(tag.text);
  return ts.isJsxNamespacedName(tag);
}

function tagText(tag: ts.JsxTagNameExpression): string {
  return tag.getText();
}

/** The words of a literal that could each be a CSS value or a utility class. */
function words(text: string): readonly string[] {
  return text.split(/[\s,;()'"`]+/).filter((word) => word.length > 0);
}

function rawVisualValue(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) return undefined;
  if (COLOR_FUNCTION.test(trimmed)) return 'a color function';
  if (EASING.test(trimmed)) return 'an easing curve';
  if (FONT_NAME.test(trimmed) || GENERIC_FONT.test(trimmed))
    return 'a font name';
  const tokens = words(trimmed);
  const whole = tokens.length === 1;
  const cssOnly = tokens.every(
    (token) =>
      LENGTH.test(token) ||
      PERCENT.test(token) ||
      DURATION.test(token) ||
      HEX_COLOR.test(token) ||
      /^(0|auto|solid|dashed|none|calc|var|min|max|clamp|[-+*/])$/.test(token)
  );
  for (const token of tokens) {
    if (LENGTH.test(token)) return `the length \`${token}\``;
    if (HEX_COLOR.test(token) && (whole || !AMBIGUOUS_HEX.test(token)))
      return `the color \`${token}\``;
    if (PERCENT.test(token) && cssOnly) return `the size \`${token}\``;
    if (DURATION.test(token) && cssOnly) return `the duration \`${token}\``;
  }
  return undefined;
}

function utilityClass(text: string): string | undefined {
  const tokens = text.split(/\s+/).filter((token) => token.length > 0);
  const hit = tokens.find((token) => UTILITY_CLASS.test(token));
  if (hit !== undefined) return hit;
  // Two bare layout words side by side (`box text`) are a class string too.
  const bare = tokens.filter((token) => UTILITY_COMPANION.test(token));
  return tokens.length > 1 && bare.length === tokens.length
    ? bare[0]
    : undefined;
}

function marginClass(text: string): string | undefined {
  return text.split(/\s+/).find((token) => MARGIN_CLASS.test(token));
}

function isModuleSpecifier(node: ts.Node): boolean {
  const parent = node.parent;
  return (
    ts.isImportDeclaration(parent) ||
    ts.isExportDeclaration(parent) ||
    ts.isExternalModuleReference(parent) ||
    (ts.isLiteralTypeNode(parent) && ts.isImportTypeNode(parent.parent)) ||
    (ts.isCallExpression(parent) &&
      (parent.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(parent.expression) &&
          parent.expression.text === 'require')))
  );
}

function literalText(node: ts.Node): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node)
  )
    return node.text;
  return undefined;
}

function hasPrimitiveType(type: ts.TypeNode | undefined): boolean {
  if (type === undefined) return false;
  if (
    type.kind === ts.SyntaxKind.StringKeyword ||
    type.kind === ts.SyntaxKind.NumberKeyword
  )
    return true;
  if (ts.isUnionTypeNode(type) || ts.isIntersectionTypeNode(type))
    return type.types.some(hasPrimitiveType);
  if (ts.isParenthesizedTypeNode(type)) return hasPrimitiveType(type.type);
  return false;
}

function memberName(name: ts.PropertyName | undefined): string | undefined {
  if (name === undefined) return undefined;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return undefined;
}

function checkImport(specifier: string, at: number, report: Report): void {
  if (STYLE_IMPORT.test(specifier))
    report(at, 'style-import', `stylesheet import \`${specifier}\``);
  if (PLATFORM_IMPORT.test(specifier))
    report(
      at,
      'platform-import',
      `\`${specifier}\` is a platform module; mount and portal through the design system`
    );
  if (THIRD_PARTY_UI.test(specifier))
    report(
      at,
      'third-party-ui',
      `third-party UI, icon, styling or animation library \`${specifier}\``
    );
}

function checkJsx(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  kind: PackageKind,
  report: Report
): void {
  const intrinsic = isIntrinsicTag(node.tagName);
  if (intrinsic && isComposer(kind))
    report(
      node.getStart(),
      'intrinsic-element',
      `intrinsic element <${tagText(node.tagName)}>; compose a design-system component`
    );
  for (const attribute of node.attributes.properties) {
    if (ts.isJsxSpreadAttribute(attribute)) {
      if (intrinsic && kind === 'ui')
        report(
          attribute.getStart(),
          'rest-spread',
          `spread onto <${tagText(node.tagName)}>; pass each allowed attribute by name`
        );
      continue;
    }
    if (!isComposer(kind)) continue;
    const name = jsxName(attribute.name);
    const styled = name.namespace ?? name.local;
    if (STYLE_ATTRIBUTES.has(styled))
      report(
        attribute.getStart(),
        'style-attribute',
        `styling attribute \`${attribute.name.getText()}\``
      );
    if (name.namespace === undefined && name.local === 'ref')
      report(
        attribute.getStart(),
        'dom-ref',
        'DOM `ref`; use a focus, scroll or measure API of the design system'
      );
    if (name.namespace === 'use')
      report(
        attribute.getStart(),
        'dom-ref',
        `directive \`${attribute.name.getText()}\` reaches the DOM element`
      );
    if (
      name.namespace === undefined &&
      Z_INDEX_NAMES.has(name.local) &&
      attribute.initializer !== undefined &&
      ts.isJsxExpression(attribute.initializer) &&
      attribute.initializer.expression !== undefined &&
      ts.isNumericLiteral(attribute.initializer.expression)
    )
      report(attribute.getStart(), 'raw-visual-value', 'numeric z-index');
  }
}

function checkLiteral(
  node: ts.Node,
  text: string,
  kind: PackageKind,
  report: Report
): void {
  if (kind !== 'ui' && MEDIA_QUERY.test(text))
    report(
      node.getStart(),
      'media-query',
      'media query outside the design system; use breakpoint tokens'
    );
  if (kind === 'ui') {
    const margin = marginClass(text);
    if (margin !== undefined)
      report(
        node.getStart(),
        'outer-margin',
        `margin utility \`${margin}\`; spacing between siblings is the parent layout's gap`
      );
  }
  if (!isComposer(kind)) return;
  const raw = rawVisualValue(text);
  if (raw !== undefined)
    report(
      node.getStart(),
      'raw-visual-value',
      `${raw} is a raw visual value; use a design token`
    );
  const utility = utilityClass(text);
  if (utility !== undefined)
    report(
      node.getStart(),
      'utility-class',
      `utility class \`${utility}\`; layout and paint come from design-system props`
    );
}

function checkUiMember(
  node: ts.PropertySignature | ts.PropertyDeclaration,
  report: Report
): void {
  const name = memberName(node.name);
  if (name === undefined) return;
  if (OPEN_STYLE_PROP.test(name))
    report(
      node.getStart(),
      'open-style-prop',
      `prop \`${name}\` hands styling to the caller`
    );
  else if (VISUAL_PROP.test(name) && hasPrimitiveType(node.type))
    report(
      node.getStart(),
      'untyped-visual-prop',
      `visual prop \`${name}\` accepts string or number; type it as a union of token names`
    );
}

function checkUiNode(node: ts.Node, report: Report): void {
  if (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node))
    checkUiMember(node, report);
  if (
    ts.isTypeReferenceNode(node) &&
    /^(JSX\.[A-Za-z]*Attributes(<|$)|ComponentProps<\s*['"])/.test(
      node.getText()
    )
  )
    report(
      node.getStart(),
      'open-props',
      `\`${node.typeName.getText()}\` opens the prop allowlist to every DOM attribute`
    );
  if (
    (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) &&
    node.name !== undefined &&
    ts.isIdentifier(node.name) &&
    COMBINED_COMPONENT.test(node.name.text)
  )
    report(
      node.getStart(),
      'combined-component',
      `\`${node.name.text}\` welds semantics to layout; compose the two components`
    );
}

function checkComposerNode(
  node: ts.Node,
  declared: ReadonlySet<string>,
  report: Report
): void {
  if (
    ts.isTaggedTemplateExpression(node) ||
    (ts.isCallExpression(node) && ts.isIdentifier(node.expression))
  ) {
    const callee = ts.isTaggedTemplateExpression(node)
      ? node.tag
      : node.expression;
    const root = ts.isPropertyAccessExpression(callee)
      ? callee.expression
      : callee;
    if (
      ts.isIdentifier(root) &&
      CSS_IN_JS_TAGS.has(root.text) &&
      (ts.isTaggedTemplateExpression(node) || !declared.has(root.text))
    )
      report(node.getStart(), 'css-in-js', `CSS-in-JS \`${root.text}\``);
  }
  if (ts.isAsExpression(node) && node.type.getText() !== 'const')
    report(
      node.getStart(),
      'type-assertion',
      `\`as ${node.type.getText().slice(0, 40)}\`; narrow with a guard or annotate the declaration`
    );
  if (ts.isTypeAssertionExpression(node) && node.type.getText() !== 'const')
    report(node.getStart(), 'type-assertion', 'angle-bracket type assertion');
  if (
    ts.isPropertyAssignment(node) &&
    Z_INDEX_NAMES.has(memberName(node.name) ?? '') &&
    ts.isNumericLiteral(node.initializer)
  )
    report(node.getStart(), 'raw-visual-value', 'numeric z-index');
  if (
    ts.isIdentifier(node) &&
    PLATFORM_GLOBALS.has(node.text) &&
    !declared.has(node.text) &&
    isReference(node)
  )
    report(
      node.getStart(),
      'platform-global',
      `platform global \`${node.text}\`; use a design-system or port API`
    );
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    GLOBAL_OBJECTS.has(node.expression.text) &&
    node.expression.text !== 'window' &&
    !declared.has(node.expression.text) &&
    PLATFORM_GLOBALS.has(node.name.text)
  )
    report(
      node.getStart(),
      'platform-global',
      `platform global \`${node.expression.text}.${node.name.text}\``
    );
}

function checkScript(
  source: PatternSource,
  kind: PackageKind,
  report: Report
): void {
  const file = ts.createSourceFile(
    source.path,
    source.text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(source.path)
  );
  const declared = isComposer(kind) ? declaredNames(file) : new Set<string>();
  const uiSource = kind === 'ui' && source.path.startsWith('src/');
  function visit(node: ts.Node): void {
    if (node.kind === ts.SyntaxKind.AnyKeyword)
      report(
        node.getStart(),
        'explicit-any',
        '`any` switches type checking off'
      );
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      checkJsx(node, kind, report);
    const text = literalText(node);
    if (text !== undefined) {
      if (isModuleSpecifier(node)) {
        if (DEEP_WORKSPACE_IMPORT.test(text))
          report(
            node.getStart(),
            'deep-import',
            `\`${text}\` reaches past a package's public entry points`
          );
        if (/^\.\.?\//.test(text) && escapesPackage(source.path, text))
          report(
            node.getStart(),
            'deep-import',
            `\`${text}\` leaves the package; import the other package's public entry point`
          );
        if (isComposer(kind)) checkImport(text, node.getStart(), report);
      } else checkLiteral(node, text, kind, report);
    }
    if (isComposer(kind)) checkComposerNode(node, declared, report);
    if (uiSource) checkUiNode(node, report);
    ts.forEachChild(node, visit);
  }
  visit(file);
  for (const comment of comments(source.text, scriptKind(source.path)))
    if (SUPPRESSION.test(comment.text))
      report(
        comment.pos,
        'suppression',
        `\`${SUPPRESSION.exec(comment.text)?.[0] ?? ''}\` directive; no check can be switched off`
      );
}

/** Whether a relative specifier climbs out of the package root. */
function escapesPackage(path: string, specifier: string): boolean {
  const stack = path.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      if (stack.length === 0) return true;
      stack.pop();
    } else stack.push(part);
  }
  return false;
}

type Comment = { readonly pos: number; readonly text: string };

function comments(text: string, kind: ts.ScriptKind): readonly Comment[] {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    kind === ts.ScriptKind.TSX
      ? ts.LanguageVariant.JSX
      : ts.LanguageVariant.Standard,
    text
  );
  const out: Comment[] = [];
  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    )
      out.push({ pos: scanner.getTokenStart(), text: scanner.getTokenText() });
    token = scanner.scan();
  }
  return out;
}

function checkStyleFile(
  source: PatternSource,
  kind: PackageKind,
  report: Report
): void {
  if (isComposer(kind)) {
    report(0, 'style-file', 'stylesheet in a composing package');
    return;
  }
  const lines = source.text.split('\n');
  let offset = 0;
  for (const line of lines) {
    if (SUPPRESSION.test(line))
      report(offset, 'suppression', 'suppression directive in a stylesheet');
    if (kind !== 'ui' && MEDIA_QUERY.test(line))
      report(offset, 'media-query', 'media query outside the design system');
    if (kind === 'ui' && MARGIN_DECLARATION.test(line))
      report(
        offset,
        'outer-margin',
        'margin declaration; spacing between siblings is a parent gap'
      );
    offset += line.length + 1;
  }
}

function checkMarkupFile(
  source: PatternSource,
  kind: PackageKind,
  report: Report
): void {
  if (!isComposer(kind)) return;
  const patterns: readonly (readonly [RegExp, string, string])[] = [
    [/<style[\s>]/g, 'style-attribute', '<style> block in markup'],
    [/\sstyle\s*=/g, 'style-attribute', 'inline `style` in markup'],
    [/\sclass\s*=/g, 'style-attribute', '`class` in markup'],
    [
      /<link[^>]+rel\s*=\s*["']?stylesheet/g,
      'style-import',
      'stylesheet link in markup',
    ],
  ];
  for (const [pattern, rule, message] of patterns)
    for (const match of source.text.matchAll(pattern))
      report(match.index, rule, message);
}

/** Every forbidden pattern in `sources` (package-relative paths) for a package of `kind`. */
export function patternViolations(
  kind: PackageKind,
  sources: readonly PatternSource[]
): readonly PatternViolation[] {
  const out: PatternViolation[] = [];
  for (const source of sources) {
    const starts = lineStarts(source.text);
    const report: Report = (pos, rule, message) => {
      const line = lineOf(starts, pos);
      out.push({
        path: source.path,
        line: line + 1,
        column: pos - (starts[line] ?? 0) + 1,
        rule,
        message,
      });
    };
    if (SCRIPT_FILE.test(source.path)) checkScript(source, kind, report);
    else if (STYLE_FILE.test(source.path)) checkStyleFile(source, kind, report);
    else if (MARKUP_FILE.test(source.path))
      checkMarkupFile(source, kind, report);
  }
  return out;
}

/** Whether the pattern pass reads `path`. */
export function isPatternSource(path: string): boolean {
  return (
    SCRIPT_FILE.test(path) || STYLE_FILE.test(path) || MARKUP_FILE.test(path)
  );
}

function lineStarts(text: string): readonly number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++)
    if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

function lineOf(starts: readonly number[], pos: number): number {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if ((starts[mid] ?? 0) <= pos) low = mid;
    else high = mid - 1;
  }
  return low;
}
