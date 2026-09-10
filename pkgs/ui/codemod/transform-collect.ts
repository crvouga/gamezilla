/**
 * Binding resolution, scope-aware shadowing, and JSX node collection for the
 * sx-codemod. Split from `transform.ts` to stay under the file size cap.
 */

import ts from 'typescript';
import { isConvertibleExport } from './transform-kinds';

/** Module-tail → export name for relative imports inside `@pkgs/ui`. */
export const PRIMITIVE_MODULE_EXPORT: Readonly<Record<string, string>> = {
  box: 'Box',
  stack: 'Stack',
  center: 'Center',
  spacer: 'Spacer',
  clickable: 'Clickable',
  text: 'Text',
  card: 'Card',
  divider: 'Divider',
  'scroll-view': 'ScrollView',
  'virtual-list': 'VirtualList',
  motion: 'Motion',
  island: 'Island',
  'gradient-box': 'GradientBox',
};

export type PendingNode = {
  readonly element: ts.JsxOpeningLikeElement;
  readonly isSelfClosing: boolean;
  readonly closeTag?: ts.JsxClosingElement | undefined;
  readonly exportName: string;
  /** Full JSX element span (open through close). */
  readonly spanStart: number;
  readonly spanEnd: number;
};

/** Local JSX names bound to convertible primitive exports. */
export function resolveBindings(source: ts.SourceFile): Map<string, string> {
  const bindings = new Map<string, string>();
  for (const stmt of source.statements) {
    addImportBindings(stmt, bindings);
  }
  return bindings;
}

function addImportBindings(
  stmt: ts.Statement,
  bindings: Map<string, string>
): void {
  if (!ts.isImportDeclaration(stmt)) return;
  const module = stmt.moduleSpecifier;
  if (!ts.isStringLiteral(module)) return;
  const clause = stmt.importClause;
  if (clause === undefined || clause.namedBindings === undefined) return;
  if (!ts.isNamedImports(clause.namedBindings)) return;
  const expected = expectedExportForModule(module.text);
  for (const el of clause.namedBindings.elements) {
    addNamedBinding(el, expected, bindings);
  }
}

function addNamedBinding(
  el: ts.ImportSpecifier,
  expected: string | undefined,
  bindings: Map<string, string>
): void {
  const exportName =
    el.propertyName !== undefined ? el.propertyName.text : el.name.text;
  if (
    expected === '*' ||
    (expected !== undefined && exportName === expected) ||
    isConvertibleExport(exportName)
  ) {
    bindings.set(el.name.text, exportName);
  }
}

/**
 * `@pkgs/ui` barrel may export any convertible; relative tails map 1:1
 * (`../box` → only `Box`, etc.).
 */
export function expectedExportForModule(
  modulePath: string
): string | undefined {
  if (modulePath === '@pkgs/ui') return '*';
  if (!(modulePath.startsWith('./') || modulePath.startsWith('../'))) {
    return undefined;
  }
  const cleaned = modulePath.replace(/\\/g, '/').replace(/\/index$/, '');
  const base = cleaned.split('/').pop() ?? '';
  return PRIMITIVE_MODULE_EXPORT[base];
}

/** True when the module path is a relative primitive the transform may empty. */
export function isPrunableModule(modulePath: string): boolean {
  if (modulePath === '@pkgs/ui') return true;
  return expectedExportForModule(modulePath) !== undefined;
}

/** True when `name` is bound in an enclosing scope of `use` (not file-wide). */
export function isShadowedAt(use: ts.Node, name: string): boolean {
  let scope: ts.Node | undefined = use.parent;
  while (scope !== undefined) {
    if (scopeBinds(scope, name)) return true;
    scope = scope.parent;
  }
  return false;
}

function scopeBinds(scope: ts.Node, name: string): boolean {
  if (functionScopeBinds(scope, name)) return true;
  if (namedDeclarationBinds(scope, name)) return true;
  return blockScopeBinds(scope, name);
}

function functionScopeBinds(scope: ts.Node, name: string): boolean {
  if (!isFunctionLike(scope)) return false;
  for (const param of scope.parameters) {
    if (bindsBindingName(param.name, name)) return true;
  }
  return false;
}

function namedDeclarationBinds(scope: ts.Node, name: string): boolean {
  if (ts.isFunctionDeclaration(scope) && scope.name?.text === name) return true;
  if (ts.isClassDeclaration(scope) && scope.name?.text === name) return true;
  return false;
}

function blockScopeBinds(scope: ts.Node, name: string): boolean {
  if (
    !(ts.isBlock(scope) || ts.isSourceFile(scope) || ts.isModuleBlock(scope))
  ) {
    return false;
  }
  for (const stmt of scope.statements) {
    if (statementBinds(stmt, name)) return true;
  }
  return false;
}

function isFunctionLike(
  node: ts.Node
): node is ts.FunctionLikeDeclarationBase & ts.Node {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node)
  );
}

function bindsBindingName(binding: ts.BindingName, name: string): boolean {
  if (ts.isIdentifier(binding)) return binding.text === name;
  for (const el of binding.elements) {
    if (ts.isOmittedExpression(el)) continue;
    if (bindsBindingName(el.name, name)) return true;
  }
  return false;
}

function statementBinds(stmt: ts.Statement, name: string): boolean {
  if (ts.isVariableStatement(stmt)) {
    for (const decl of stmt.declarationList.declarations) {
      if (bindsBindingName(decl.name, name)) return true;
    }
    return false;
  }
  if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === name) return true;
  if (ts.isClassDeclaration(stmt) && stmt.name?.text === name) return true;
  if (
    (ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt)) &&
    stmt.name.text === name
  ) {
    return true;
  }
  return false;
}

export function hasSpread(element: ts.JsxOpeningLikeElement): boolean {
  return element.attributes.properties.some((p) => ts.isJsxSpreadAttribute(p));
}

export function tagName(element: ts.JsxOpeningLikeElement): string | undefined {
  const tag = element.tagName;
  if (ts.isIdentifier(tag)) return tag.text;
  return undefined;
}

export function lineOf(source: ts.SourceFile, pos: number): number {
  return source.getLineAndCharacterOfPosition(pos).line + 1;
}

export function carriesSx(element: ts.JsxOpeningLikeElement): boolean {
  return element.attributes.properties.some(
    (p) =>
      ts.isJsxAttribute(p) &&
      ts.isIdentifier(p.name) &&
      (p.name.text === 'sx' ||
        p.name.text === 'frameSx' ||
        p.name.text === 'enterSx' ||
        p.name.text === 'exitSx' ||
        p.name.text === 'fieldSx')
  );
}

export function collectNodes(
  source: ts.SourceFile,
  bindings: Map<string, string>
): PendingNode[] {
  const out: PendingNode[] = [];
  function visit(node: ts.Node): void {
    if (ts.isJsxSelfClosingElement(node)) {
      pushSelfClosing(node, bindings, out);
    } else if (ts.isJsxElement(node)) {
      pushElement(node, bindings, out);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return out;
}

function pushSelfClosing(
  node: ts.JsxSelfClosingElement,
  bindings: Map<string, string>,
  out: PendingNode[]
): void {
  const name = tagName(node);
  const exportName = name === undefined ? undefined : bindings.get(name);
  if (
    exportName === undefined ||
    name === undefined ||
    isShadowedAt(node, name)
  ) {
    return;
  }
  out.push({
    element: node,
    isSelfClosing: true,
    exportName,
    spanStart: node.getStart(),
    spanEnd: node.end,
  });
}

function pushElement(
  node: ts.JsxElement,
  bindings: Map<string, string>,
  out: PendingNode[]
): void {
  const name = tagName(node.openingElement);
  const exportName = name === undefined ? undefined : bindings.get(name);
  if (
    exportName === undefined ||
    name === undefined ||
    isShadowedAt(node, name)
  ) {
    return;
  }
  out.push({
    element: node.openingElement,
    isSelfClosing: false,
    closeTag: node.closingElement,
    exportName,
    spanStart: node.getStart(),
    spanEnd: node.end,
  });
}

/** A node is a leaf when no other pending node is strictly nested inside it. */
export function isLeafNode(
  node: PendingNode,
  all: readonly PendingNode[]
): boolean {
  return !all.some(
    (other) =>
      other !== node &&
      other.spanStart > node.spanStart &&
      other.spanEnd < node.spanEnd
  );
}
