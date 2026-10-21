/**
 * Reads every exported Solid component of a package through the TypeScript
 * type checker: its name and each prop with the type the checker resolves,
 * whether it is optional, and its doc comment.
 */
import ts from 'typescript';
import type { ComponentFact, PropFact } from './inventory-types';

const FORMAT =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.WriteArrowStyleSignature |
  ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

function returnsJsx(signature: ts.Signature, checker: ts.TypeChecker): boolean {
  const text = checker.typeToString(signature.getReturnType());
  return /\bElement\b/.test(text) || text === 'JSX.Element';
}

function withoutUndefined(type: string): string {
  return type
    .split(' | ')
    .filter((part) => part !== 'undefined')
    .join(' | ');
}

/**
 * `'sm' | 'md' | 'lg'` behind an alias → `['sm', 'md', 'lg']`; null unless
 * every member (besides `undefined`) is a string, number or boolean literal.
 */
function literalMembers(
  type: ts.Type,
  checker: ts.TypeChecker
): string[] | null {
  if (!type.isUnion()) return null;
  const members = type.types.filter(
    (t) => (t.flags & ts.TypeFlags.Undefined) === 0
  );
  const literal = members.every(
    (t) => t.isLiteral() || (t.flags & ts.TypeFlags.BooleanLiteral) !== 0
  );
  if (!literal || members.length < 2) return null;
  return members.map((t) => checker.typeToString(t));
}

/** True when a prop is declared inside one of `ownRoots` (not a DOM type). */
function isOwn(symbol: ts.Symbol, ownRoots: readonly string[]): boolean {
  const declarations = symbol.getDeclarations() ?? [];
  return declarations.some((d) => {
    const file = d.getSourceFile().fileName;
    return ownRoots.some((root) => file.includes(root));
  });
}

type PropsContext = {
  readonly checker: ts.TypeChecker;
  readonly at: ts.Node;
  readonly ownRoots: readonly string[];
  readonly defaults: ReadonlyMap<string, string>;
};

function propFacts(
  type: ts.Type,
  context: PropsContext
): { props: PropFact[]; foreign: number } {
  const { checker, at } = context;
  const props: PropFact[] = [];
  let foreign = 0;
  for (const symbol of checker.getPropertiesOfType(type)) {
    if (!isOwn(symbol, context.ownRoots)) {
      foreign += 1;
      continue;
    }
    const propType = checker.getTypeOfSymbolAtLocation(symbol, at);
    props.push({
      name: symbol.name,
      type: withoutUndefined(checker.typeToString(propType, at, FORMAT)),
      optional: (symbol.flags & ts.SymbolFlags.Optional) !== 0,
      doc: ts
        .displayPartsToString(symbol.getDocumentationComment(checker))
        .replace(/\s+/g, ' ')
        .trim(),
      defaultText: context.defaults.get(symbol.name) ?? null,
      values: literalMembers(propType, checker),
    });
  }
  return { props, foreign };
}

function componentFact(
  symbol: ts.Symbol,
  context: Omit<PropsContext, 'at'>
): ComponentFact | null {
  const { checker } = context;
  const declaration = symbol.valueDeclaration;
  if (declaration === undefined || !/^[A-Z]/.test(symbol.name)) return null;
  const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
  const [signature] = type.getCallSignatures();
  if (signature === undefined || !returnsJsx(signature, checker)) return null;
  const [param] = signature.getParameters();
  if (param === undefined) {
    return { name: symbol.name, props: [], foreignPropCount: 0 };
  }
  const paramType = checker.getTypeOfSymbolAtLocation(param, declaration);
  const { props, foreign } = propFacts(paramType, {
    ...context,
    at: declaration,
  });
  return { name: symbol.name, props, foreignPropCount: foreign };
}

/** The exported components of one source file. */
export function readComponents(
  program: ts.Program,
  file: ts.SourceFile,
  options: {
    readonly ownRoots: readonly string[];
    readonly defaults: ReadonlyMap<string, string>;
  }
): ComponentFact[] {
  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(file);
  if (moduleSymbol === undefined) return [];
  const out: ComponentFact[] = [];
  for (const exported of checker.getExportsOfModule(moduleSymbol)) {
    const symbol =
      (exported.flags & ts.SymbolFlags.Alias) !== 0
        ? checker.getAliasedSymbol(exported)
        : exported;
    if (symbol.valueDeclaration?.getSourceFile() !== file) continue;
    const fact = componentFact(symbol, { checker, ...options });
    if (fact !== null) out.push({ ...fact, name: exported.name });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Names a source file exports, values and types alike. */
export function exportNames(
  program: ts.Program,
  file: ts.SourceFile
): string[] {
  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(file);
  if (moduleSymbol === undefined) return [];
  return checker.getExportsOfModule(moduleSymbol).map((s) => s.name);
}
