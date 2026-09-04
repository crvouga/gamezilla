/**
 * Jest-only: jest-expo resolves `./sim-sql-backend-real` to the Hermes mem stub
 * after preset plugins run. Rewrite require/import strings on Program exit.
 */
const path = require('node:path');

const FABRIC_RE =
  /^(\.\/sim-sql-backend-real)(?:\.native)?(?:\.(tsx|ts|jsx|js))?$/;

function rewriteFabricSource(value) {
  if (typeof value !== 'string') return value;
  const m = value.match(FABRIC_RE);
  if (m === null) return value;
  return './sim-sql-backend-real.node';
}

module.exports = function simSqlFabricJestPlugin() {
  return {
    name: 'sim-sql-engines-jest',
    visitor: {
      Program: {
        exit(programPath, state) {
          const file = state.filename ?? state.file?.opts?.filename ?? '';
          if (!file.endsWith(`${path.sep}sim-sql-engines.ts`)) return;
          programPath.traverse({
            ImportDeclaration(importPath) {
              importPath.node.source.value = rewriteFabricSource(
                importPath.node.source.value
              );
            },
            ExportNamedDeclaration(exportPath) {
              if (exportPath.node.source == null) return;
              exportPath.node.source.value = rewriteFabricSource(
                exportPath.node.source.value
              );
            },
            CallExpression(callPath) {
              const callee = callPath.node.callee;
              if (
                callee.type !== 'Identifier' ||
                callee.name !== 'require' ||
                callPath.node.arguments.length !== 1
              ) {
                return;
              }
              const arg = callPath.node.arguments[0];
              if (arg?.type !== 'StringLiteral') return;
              arg.value = rewriteFabricSource(arg.value);
            },
          });
        },
      },
    },
  };
};
