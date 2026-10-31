/**
 * Reads what one component module's markup says: the `data-component`
 * names it sets, its roles and ARIA attributes, the DOM events it handles,
 * the `classList` branches that are its states, the keys it compares
 * against, and the defaults it falls back to.
 */
import ts from 'typescript';
import type { AttributeFact, MarkupFact } from './inventory-types';

/** `KeyboardEvent.key` values the components compare against. */
export const KEY_NAMES: ReadonlySet<string> = new Set([
  'Enter',
  'Escape',
  'Esc',
  ' ',
  'Spacebar',
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Backspace',
  'Delete',
]);

const SHARED_PREFIX = '@pkgs/ui-root-shared-ts/';

const EQUALITY = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
]);

/**
 * A key name where a key is compared: `e.key === 'Enter'`, `case 'Home':`,
 * a list of keys, or a key map's property (`{ ArrowUp: … }`). A `' '`
 * passed to `join` is not a key.
 */
export function keyAt(node: ts.Node): string | null {
  const parent = node.parent;
  if (parent === undefined) return null;
  if (ts.isStringLiteral(node) && KEY_NAMES.has(node.text)) {
    const compared =
      (ts.isBinaryExpression(parent) &&
        EQUALITY.has(parent.operatorToken.kind)) ||
      ts.isCaseClause(parent) ||
      ts.isArrayLiteralExpression(parent) ||
      (ts.isPropertyAssignment(parent) && parent.name === node);
    return compared ? node.text : null;
  }
  if (
    ts.isIdentifier(node) &&
    KEY_NAMES.has(node.text) &&
    ts.isPropertyAssignment(parent) &&
    parent.name === node
  ) {
    return node.text;
  }
  return null;
}

type Collector = {
  dataComponents: Set<string>;
  roles: Set<string>;
  aria: AttributeFact[];
  domEvents: AttributeFact[];
  dataAttributes: AttributeFact[];
  tabIndex: AttributeFact[];
  classListStates: AttributeFact[];
  classes: Set<string>;
  testIds: Set<string>;
  keys: Set<string>;
  globalKeyListeners: number;
  defaults: Map<string, string>;
  sharedModules: Set<string>;
};

function emptyCollector(): Collector {
  return {
    dataComponents: new Set(),
    roles: new Set(),
    aria: [],
    domEvents: [],
    dataAttributes: [],
    tabIndex: [],
    classListStates: [],
    classes: new Set(),
    testIds: new Set(),
    keys: new Set(),
    globalKeyListeners: 0,
    defaults: new Map(),
    sharedModules: new Set(),
  };
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function tagName(node: ts.JsxAttribute): string {
  const owner = node.parent.parent;
  if (ts.isJsxOpeningElement(owner) || ts.isJsxSelfClosingElement(owner)) {
    return owner.tagName.getText();
  }
  return '?';
}

function attributeValue(node: ts.JsxAttribute): string {
  const init = node.initializer;
  if (init === undefined) return 'true';
  if (ts.isStringLiteral(init)) return JSON.stringify(init.text);
  if (ts.isJsxExpression(init) && init.expression !== undefined) {
    return oneLine(init.expression.getText());
  }
  return oneLine(init.getText());
}

/** Every string literal inside an expression (class names in templates). */
function stringsIn(node: ts.Node): string[] {
  const out: string[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      out.push(n.text);
    } else if (ts.isTemplateExpression(n)) {
      out.push(n.head.text, ...n.templateSpans.map((s) => s.literal.text));
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

function addClasses(into: Set<string>, texts: readonly string[]): void {
  for (const text of texts) {
    for (const name of text.split(/\s+/)) if (name !== '') into.add(name);
  }
}

function classListStates(node: ts.JsxAttribute): AttributeFact[] {
  const init = node.initializer;
  if (init === undefined || !ts.isJsxExpression(init)) return [];
  const object = init.expression;
  if (object === undefined || !ts.isObjectLiteralExpression(object)) return [];
  const element = tagName(node);
  return object.properties.flatMap((p) => {
    if (!ts.isPropertyAssignment(p)) return [];
    const name = ts.isStringLiteral(p.name) ? p.name.text : p.name.getText();
    return [{ element, name, value: oneLine(p.initializer.getText()) }];
  });
}

/** `dataSet={{ … }}` handed to a component. */
function onDataSetAttribute(
  node: ts.JsxAttribute,
  element: string,
  c: Collector
): void {
  const init = node.initializer;
  const object =
    init !== undefined && ts.isJsxExpression(init)
      ? init.expression
      : undefined;
  if (object !== undefined && ts.isObjectLiteralExpression(object)) {
    onDataSet(object, element, c);
  }
}

function onAttribute(node: ts.JsxAttribute, c: Collector): void {
  const name = node.name.getText();
  const element = tagName(node);
  const fact = { element, name, value: attributeValue(node) };
  const intrinsic = /^[a-z]/.test(element);
  if (name === 'role') {
    c.roles.add(fact.value.replace(/^"|"$/g, ''));
  } else if (name.startsWith('aria-')) {
    c.aria.push(fact);
  } else if (name === 'tabIndex' || name === 'tabindex') {
    c.tabIndex.push(fact);
  } else if (name === 'classList') {
    const states = classListStates(node);
    c.classListStates.push(...states);
    addClasses(
      c.classes,
      states.map((state) => state.name)
    );
  } else if (name === 'class' && node.initializer !== undefined) {
    addClasses(c.classes, stringsIn(node.initializer));
  } else if (name === 'dataSet') {
    onDataSetAttribute(node, element, c);
  } else if (name === 'data-testid' || name === 'testId') {
    c.testIds.add(fact.value);
  } else if (name.startsWith('data-')) {
    c.dataAttributes.push(fact);
  } else if (intrinsic && /^on[A-Z:]/.test(name)) {
    c.domEvents.push(fact);
  }
}

/** Document key listeners and `mergeProps` defaults. */
/** The JSX element a `{...dataAttrs(…)}` spread lands on. */
function spreadTarget(node: ts.Node): string {
  const spread = node.parent;
  const owner = spread?.parent?.parent;
  if (
    spread !== undefined &&
    ts.isJsxSpreadAttribute(spread) &&
    owner !== undefined &&
    (ts.isJsxOpeningElement(owner) || ts.isJsxSelfClosingElement(owner))
  ) {
    return owner.tagName.getText();
  }
  return '?';
}

/**
 * `{ intent: …, size: … }` handed to `dataAttrs` or a `dataSet` becomes
 * `data-intent` / `data-size`: the hooks the stylesheets select variants by.
 * `component` is the `data-component` name; `testid` is a test id.
 */
function onDataSet(
  object: ts.ObjectLiteralExpression,
  element: string,
  c: Collector
): void {
  for (const p of object.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const key = ts.isStringLiteral(p.name) ? p.name.text : p.name.getText();
    const value = oneLine(p.initializer.getText());
    if (key === 'testid') c.testIds.add(value);
    else if (key !== 'component') {
      c.dataAttributes.push({ element, name: `data-${key}`, value });
    }
  }
}

function onCall(node: ts.CallExpression, c: Collector): void {
  const callee = node.expression.getText();
  const [first, second] = node.arguments;
  if (
    (callee === 'dataAttrs' || callee === 'componentDataAttrs') &&
    node.arguments.length > 0
  ) {
    const bag = node.arguments[node.arguments.length - 1];
    if (bag !== undefined && ts.isObjectLiteralExpression(bag)) {
      onDataSet(bag, spreadTarget(node), c);
    }
  }
  if (
    callee.endsWith('addEventListener') &&
    first !== undefined &&
    ts.isStringLiteral(first) &&
    first.text.startsWith('key')
  ) {
    c.globalKeyListeners += 1;
  }
  if (callee === 'mergeProps' && first !== undefined && second !== undefined) {
    if (ts.isObjectLiteralExpression(first)) {
      for (const p of first.properties) {
        if (ts.isPropertyAssignment(p)) {
          c.defaults.set(p.name.getText(), oneLine(p.initializer.getText()));
        }
      }
    }
  }
}

/** `props.size ?? 'md'` → `size: 'md'`. */
function onBinary(node: ts.BinaryExpression, c: Collector): void {
  if (node.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken) return;
  const left = node.left;
  if (
    ts.isPropertyAccessExpression(left) &&
    left.expression.getText() === 'props' &&
    !c.defaults.has(left.name.text)
  ) {
    c.defaults.set(left.name.text, oneLine(node.right.getText()));
  }
}

/**
 * `component: 'EmptyState'` — in `dataAttrs({ … })` or a `dataSet={{ … }}`
 * handed to a primitive, the name lands on `data-component` either way.
 */
function onProperty(node: ts.PropertyAssignment, c: Collector): void {
  if (
    node.name.getText() === 'component' &&
    ts.isStringLiteral(node.initializer) &&
    /^[A-Z][A-Za-z0-9]*$/.test(node.initializer.text)
  ) {
    c.dataComponents.add(node.initializer.text);
  }
}

function onImport(node: ts.ImportDeclaration, c: Collector): void {
  if (!ts.isStringLiteral(node.moduleSpecifier)) return;
  const specifier = node.moduleSpecifier.text;
  if (specifier.startsWith(SHARED_PREFIX) && !node.importClause?.isTypeOnly) {
    c.sharedModules.add(specifier.slice(SHARED_PREFIX.length));
  }
}

function visitNode(node: ts.Node, c: Collector): void {
  if (ts.isJsxAttribute(node)) onAttribute(node, c);
  else if (ts.isCallExpression(node)) onCall(node, c);
  else if (ts.isBinaryExpression(node)) onBinary(node, c);
  else if (ts.isImportDeclaration(node)) onImport(node, c);
  else if (ts.isPropertyAssignment(node)) onProperty(node, c);
  const key = keyAt(node);
  if (key !== null) c.keys.add(key);
  ts.forEachChild(node, (child) => visitNode(child, c));
}

const sorted = (values: Iterable<string>): string[] => [...values].sort();

/** What one module's markup says. */
export function readMarkup(source: ts.SourceFile): MarkupFact {
  const c = emptyCollector();
  const syntax = ts.createSourceFile(
    source.fileName,
    source.text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  visitNode(syntax, c);
  return {
    dataComponents: sorted(c.dataComponents),
    roles: sorted(c.roles),
    aria: c.aria,
    domEvents: c.domEvents,
    dataAttributes: c.dataAttributes,
    tabIndex: c.tabIndex,
    classListStates: c.classListStates,
    classes: sorted(c.classes),
    testIds: sorted(c.testIds),
    keys: sorted(c.keys),
    globalKeyListeners: c.globalKeyListeners,
    defaults: c.defaults,
    sharedModules: sorted(c.sharedModules),
  };
}

/** The key names a plain logic module compares against. */
export function readKeys(source: ts.SourceFile): string[] {
  const keys = new Set<string>();
  const visit = (node: ts.Node): void => {
    const key = keyAt(node);
    if (key !== null) keys.add(key);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return sorted(keys);
}
