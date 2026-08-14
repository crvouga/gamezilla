#!/usr/bin/env bun
// @io-wall-ok — tools composition root

/**
 * Fail if libs export top-level functions that take injected dependencies
 * (SqlClient, CreateId, …) as parameters. Prefer constructor-injected classes.
 *
 * Baseline ratchet: tools/scripts/no-top-level-di-baseline.json
 * - New violations not in baseline → fail
 * - Baseline entries that no longer violate → fail (delete stale entries)
 *
 * Write/update baseline: WRITE_BASELINE=1 bun run tools/scripts/check-no-top-level-di-functions.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { Glob } from 'bun';
import ts from 'typescript';

const REPO_ROOT = join(import.meta.dirname, '../..');
const BASELINE_PATH = join(
  import.meta.dirname,
  'no-top-level-di-baseline.json'
);

const SCAN_GLOBS = ['libs/*/src/**/*.{ts,tsx}'] as const;

/** Exact type names treated as injectable dependencies. */
const EXACT_INJECTABLE = new Set([
  'SqlClient',
  'CreateId',
  'Logger',
  'Clock',
  'Timers',
  'Random',
  'HttpClient',
  'SecretStore',
  'Observability',
  'MutationClient',
  'AuthServerPort',
  'Stripe',
  'SecureStorageStore',
  'PostgresDbScope',
  'Io',
]);

/** Suffix patterns for injectable type names. */
const SUFFIX_INJECTABLE = [
  'Client',
  'Repository',
  'Service',
  'Publisher',
  'Store',
] as const;

/** Framework param names/types that are not product DI (mutation/query run). */
const EXEMPT_PARAM_NAMES = new Set(['tx', 'env', 'ctx']);
const EXEMPT_TYPE_NAMES = new Set([
  'MutationDb',
  'MutationEnv',
  'QueryContext',
  'QueryEnv',
  'SqlTx',
]);

/** Factory escape hatch: first param typed `SqlTx` (transaction-scoped wiring). */
function isSqlTxFactory(params: readonly ts.ParameterDeclaration[]): boolean {
  const first = params[0];
  if (first === undefined || first.type === undefined) return false;
  if (!ts.isTypeReferenceNode(first.type)) return false;
  if (!ts.isIdentifier(first.type.typeName)) return false;
  return first.type.typeName.text === 'SqlTx';
}

type Violation = {
  readonly key: string;
  readonly path: string;
  readonly line: number;
  readonly name: string;
  readonly paramType: string;
};

function isInjectableTypeName(name: string): boolean {
  if (EXACT_INJECTABLE.has(name)) return true;
  if (EXEMPT_TYPE_NAMES.has(name)) return false;
  // Avoid flagging domain DTOs like FriendRequestStatus / UserClientView.
  for (const suffix of SUFFIX_INJECTABLE) {
    if (name.length > suffix.length && name.endsWith(suffix)) return true;
  }
  return false;
}

function typeNameFromNode(node: ts.TypeNode | undefined): string | null {
  if (!node) return null;
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
    return node.typeName.text;
  }
  if (
    ts.isTypeOperatorNode(node) &&
    node.operator === ts.SyntaxKind.ReadonlyKeyword
  ) {
    return typeNameFromNode(node.type);
  }
  if (ts.isParenthesizedTypeNode(node)) {
    return typeNameFromNode(node.type);
  }
  return null;
}

/** Same-file type aliases → underlying type node (for args bags / Db picks). */
function collectTypeAliases(
  sourceFile: ts.SourceFile
): Map<string, ts.TypeNode> {
  const aliases = new Map<string, ts.TypeNode>();
  for (const stmt of sourceFile.statements) {
    if (!ts.isTypeAliasDeclaration(stmt)) continue;
    aliases.set(stmt.name.text, stmt.type);
  }
  return aliases;
}

function injectableFromTypeNode(
  typeNode: ts.TypeNode | undefined,
  aliases: Map<string, ts.TypeNode>,
  seen: Set<string> = new Set()
): string | null {
  if (!typeNode) return null;

  // Args bag: { readonly sql: SqlClient; … }
  if (ts.isTypeLiteralNode(typeNode)) {
    for (const member of typeNode.members) {
      if (!ts.isPropertySignature(member) || member.type === undefined)
        continue;
      const hit = injectableFromTypeNode(member.type, aliases, seen);
      if (hit !== null) return hit;
    }
    return null;
  }

  // Intersection / union — scan parts
  if (ts.isIntersectionTypeNode(typeNode) || ts.isUnionTypeNode(typeNode)) {
    for (const part of typeNode.types) {
      const hit = injectableFromTypeNode(part, aliases, seen);
      if (hit !== null) return hit;
    }
    return null;
  }

  if (
    ts.isTypeOperatorNode(typeNode) &&
    typeNode.operator === ts.SyntaxKind.ReadonlyKeyword
  ) {
    return injectableFromTypeNode(typeNode.type, aliases, seen);
  }
  if (ts.isParenthesizedTypeNode(typeNode)) {
    return injectableFromTypeNode(typeNode.type, aliases, seen);
  }

  // Pick<SqlClient, …> / Omit<SqlClient, …>
  if (
    ts.isTypeReferenceNode(typeNode) &&
    ts.isIdentifier(typeNode.typeName) &&
    (typeNode.typeName.text === 'Pick' ||
      typeNode.typeName.text === 'Omit' ||
      typeNode.typeName.text === 'Partial' ||
      typeNode.typeName.text === 'Required') &&
    typeNode.typeArguments !== undefined &&
    typeNode.typeArguments.length > 0
  ) {
    return injectableFromTypeNode(typeNode.typeArguments[0], aliases, seen);
  }

  const direct = typeNameFromNode(typeNode);
  if (direct !== null) {
    if (isInjectableTypeName(direct)) return direct;
    // Resolve same-file alias (Db, RunPostgresMigrationsArgs, …)
    if (aliases.has(direct) && !seen.has(direct)) {
      seen.add(direct);
      return injectableFromTypeNode(aliases.get(direct), aliases, seen);
    }
  }

  return null;
}

function isExported(node: ts.Node): boolean {
  return (
    (ts.getCombinedModifierFlags(node as ts.Declaration) &
      ts.ModifierFlags.Export) !==
    0
  );
}

function paramIsExempt(param: ts.ParameterDeclaration): boolean {
  if (!ts.isIdentifier(param.name)) return false;
  if (!EXEMPT_PARAM_NAMES.has(param.name.text)) return false;
  const typeName = typeNameFromNode(param.type);
  if (typeName !== null && EXEMPT_TYPE_NAMES.has(typeName)) return true;
  // Mutation run bags: first arg `{ tx, env }`
  if (param.type && ts.isTypeLiteralNode(param.type)) {
    return true;
  }
  return EXEMPT_PARAM_NAMES.has(param.name.text);
}

/** React components / providers (PascalCase) are props-injection, not DI targets. */
function isReactComponentName(name: string): boolean {
  return /^[A-Z]/.test(name);
}

/** React hooks use context/props; do not force class DI. */
function isReactHookName(name: string): boolean {
  return /^use[A-Z]/.test(name);
}

function checkFunctionLike(
  name: string,
  params: readonly ts.ParameterDeclaration[],
  sourceFile: ts.SourceFile,
  aliases: Map<string, ts.TypeNode>,
  out: Violation[]
): void {
  if (isReactComponentName(name) || isReactHookName(name)) return;
  if (isSqlTxFactory(params)) return;
  for (const param of params) {
    if (paramIsExempt(param)) continue;
    const paramType = injectableFromTypeNode(param.type, aliases);
    if (paramType === null) continue;
    const line =
      sourceFile.getLineAndCharacterOfPosition(param.getStart(sourceFile))
        .line + 1;
    const path = relative(REPO_ROOT, sourceFile.fileName);
    out.push({
      key: `${path}:${name}`,
      path,
      line,
      name,
      paramType,
    });
    return; // one report per function
  }
}

function scanSourceFile(sourceFile: ts.SourceFile): Violation[] {
  const aliases = collectTypeAliases(sourceFile);
  const out: Violation[] = [];

  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name && isExported(stmt)) {
      checkFunctionLike(
        stmt.name.text,
        stmt.parameters,
        sourceFile,
        aliases,
        out
      );
      continue;
    }

    if (!ts.isVariableStatement(stmt) || !isExported(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      const init = decl.initializer;
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
        checkFunctionLike(
          decl.name.text,
          init.parameters,
          sourceFile,
          aliases,
          out
        );
      }
    }
  }

  return out;
}

function shouldSkipFile(rel: string): boolean {
  if (rel.includes('/dist/')) return true;
  if (rel.includes('.test.')) return true;
  if (rel.includes('.types.test.')) return true;
  // Infra CLI uses a different composition model (CiPlatform / InfraContext).
  if (rel.startsWith('libs/infra/')) return true;
  return false;
}

const violations: Violation[] = [];

for (const pattern of SCAN_GLOBS) {
  const files = new Glob(pattern).scan({ cwd: REPO_ROOT, absolute: true });
  for await (const abs of files) {
    const rel = relative(REPO_ROOT, abs);
    if (shouldSkipFile(rel)) continue;
    const text = await Bun.file(abs).text();
    const sourceFile = ts.createSourceFile(
      abs,
      text,
      ts.ScriptTarget.Latest,
      true,
      abs.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    violations.push(...scanSourceFile(sourceFile));
  }
}

violations.sort((a, b) => a.key.localeCompare(b.key));

const writeBaseline = process.env['WRITE_BASELINE'] === '1';
if (writeBaseline) {
  const keys = violations.map((v) => v.key);
  writeFileSync(BASELINE_PATH, `${JSON.stringify(keys, null, 2)}\n`, 'utf8');
  console.log(
    `Wrote baseline (${String(keys.length)} entries) → ${relative(REPO_ROOT, BASELINE_PATH)}`
  );
  for (const v of violations) {
    console.log(`  ${v.path}:${String(v.line)}: ${v.name} — ${v.paramType}`);
  }
  process.exit(0);
}

let baseline: string[] = [];
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as string[];
} catch {
  console.error(
    `ci:no-top-level-di-functions: missing baseline at ${relative(REPO_ROOT, BASELINE_PATH)}\n` +
      'Run WRITE_BASELINE=1 bun run tools/scripts/check-no-top-level-di-functions.ts'
  );
  process.exit(1);
}

const baselineSet = new Set(baseline);
const currentKeys = new Set(violations.map((v) => v.key));

const newViolations = violations.filter((v) => !baselineSet.has(v.key));
const staleBaseline = baseline.filter((k) => !currentKeys.has(k));

if (newViolations.length > 0 || staleBaseline.length > 0) {
  console.error('ci:no-top-level-di-functions FAILED:');
  if (newViolations.length > 0) {
    console.error('\nNew violations (not in baseline) — convert to classes:');
    for (const v of newViolations) {
      console.error(
        `  - ${v.path}:${String(v.line)}: ${v.name} takes injectable '${v.paramType}'`
      );
    }
  }
  if (staleBaseline.length > 0) {
    console.error(
      '\nStale baseline entries (no longer violate) — remove from baseline:'
    );
    for (const k of staleBaseline) {
      console.error(`  - ${k}`);
    }
  }
  console.error(
    '\nSee docs/dependency-injection.md. Update baseline only via WRITE_BASELINE=1 after intentional inventory changes.'
  );
  process.exit(1);
}

console.log(
  `ci:no-top-level-di-functions OK (${String(violations.length)} baselined, ${String(baseline.length)} baseline entries)`
);
