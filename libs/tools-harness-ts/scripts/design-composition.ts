/**
 * Product screens are compositions of `@pkgs/ui-root-client-ts` components.
 * Read by `design-vocabulary.ts` for the `product` profile.
 *
 * A screen that writes `<div>`, `<button>` or `<p>` re-implements a layout
 * box, a control or a text role, and a screen that passes `class`,
 * `classList` or `style` restyles one. Both drift from every other screen,
 * so neither is something product code may write: layout is `Stack*` /
 * `Grid` props, text is `P` / `Text` / `H1`–`H6`, painting is `Surface` or a
 * component variant. A need the components cannot express becomes a new
 * component (or variant) in the design system.
 *
 * Parsed with the TypeScript compiler, so generics (`createSignal<string>`)
 * and text that merely looks like markup are never mistaken for elements.
 */

import ts from 'typescript';

export type CompositionSource = {
  readonly path: string;
  readonly text: string;
};

/** Attributes that restyle a component from the outside. */
const RESTYLING_ATTRIBUTES = new Set(['class', 'classList', 'style']);

function tagName(node: ts.JsxTagNameExpression): string | undefined {
  return ts.isIdentifier(node) ? node.text : undefined;
}

/** `div`, `button`, `svg`: lower-case names are DOM elements in Solid. */
function isIntrinsic(name: string): boolean {
  return /^[a-z]/.test(name);
}

function lineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function attributeViolations(
  source: ts.SourceFile,
  path: string,
  attributes: ts.JsxAttributes
): string[] {
  const out: string[] = [];
  for (const attribute of attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) continue;
    const name = attribute.name.getText(source);
    if (!RESTYLING_ATTRIBUTES.has(name)) continue;
    out.push(
      `${path}:${lineOf(source, attribute)}: restyling attribute "${name}" — compose a design-system component and pick its props or variant; a new look is a new variant in @pkgs/ui-root-client-ts`
    );
  }
  return out;
}

function elementViolations(
  source: ts.SourceFile,
  path: string,
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement
): string[] {
  const name = tagName(node.tagName);
  const out =
    name !== undefined && isIntrinsic(name)
      ? [
          `${path}:${lineOf(source, node)}: raw element <${name}> — use a design-system component (Stack*, Grid, Surface, P / Text, H1–H6, Pressable, Button, Link, …)`,
        ]
      : [];
  return [...out, ...attributeViolations(source, path, node.attributes)];
}

/** Every raw element and restyling attribute in one TSX source. */
export function compositionViolations(
  file: CompositionSource
): readonly string[] {
  const source = ts.createSourceFile(
    file.path,
    file.text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      out.push(...elementViolations(source, file.path, node));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}
