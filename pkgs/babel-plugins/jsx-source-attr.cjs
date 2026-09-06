/**
 * Injects `dataSet={{ src: '<repo-relative>:<line>' }}` onto allowlisted JSX
 * elements so react-native-web surfaces a `data-src` attribute in the DOM.
 *
 * Gated to web + (dev || EXPO_PUBLIC_E2E=1). Only touches elements whose
 * import source is in the allowlist (`react-native`, `@pkgs/ui-rn`, or a
 * relative import inside `pkgs/ui-rn`) to avoid handing `dataSet` to libraries
 * that spread props onto real DOM/SVG nodes.
 *
 * Injected attributes are inserted FIRST so later `{...componentDataSet(...)}`
 * spreads win the merge (outer call site beats this element's own babel src).
 */

const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '../..');

/** Import sources whose JSX hosts accept (or forward) `dataSet`. */
const ALLOWED_SOURCES = new Set(['react-native', '@pkgs/ui-rn']);

/**
 * @param {string | null | undefined} source
 * @param {string} filename
 */
function isAllowedSource(source, filename) {
  if (source == null) return false;
  if (ALLOWED_SOURCES.has(source)) return true;
  if (source.startsWith('@pkgs/ui-rn/')) return true;
  if (
    (source.startsWith('./') || source.startsWith('../')) &&
    filename.includes(`${path.sep}pkgs${path.sep}ui${path.sep}`)
  ) {
    return true;
  }
  return false;
}

/**
 * Resolve the module source string for a JSX identifier / member expression.
 * @param {*} nameNode
 * @param {*} jsxPath
 * @returns {string | null}
 */
function resolveImportSource(nameNode, jsxPath) {
  if (nameNode.type === 'JSXNamespacedName') return null;

  let root = nameNode;
  while (root.type === 'JSXMemberExpression') {
    root = root.object;
  }
  if (root.type !== 'JSXIdentifier') return null;

  // Lowercase tags are DOM/SVG intrinsics — skip.
  if (root.name === root.name.toLowerCase()) return null;

  const binding = jsxPath.scope.getBinding(root.name);
  if (!binding || binding.kind !== 'module') return null;
  const parent = binding.path.parent;
  if (parent.type !== 'ImportDeclaration') return null;
  return parent.source.value;
}

/**
 * @param {import('@babel/core')} api
 */
module.exports = function jsxSourceAttrPlugin(api) {
  const { types: t } = api;

  const platform = api.caller((caller) =>
    caller && typeof caller.platform === 'string' ? caller.platform : null
  );
  const callerName = api.caller((caller) =>
    caller && typeof caller.name === 'string' ? caller.name : null
  );
  const callerBundler = api.caller((caller) =>
    caller && typeof caller.bundler === 'string' ? caller.bundler : null
  );

  const enabled =
    process.env.NODE_ENV !== 'production' ||
    process.env.EXPO_PUBLIC_E2E === '1';

  const testCaller =
    callerName === 'bun-test' ||
    callerBundler === 'bun' ||
    callerName === 'babel-jest' ||
    callerBundler === 'jest';
  const platformOk = platform === 'web' || testCaller;

  if (!platformOk || !enabled) {
    return { name: 'jsx-source-attr', visitor: {} };
  }

  return {
    name: 'jsx-source-attr',
    visitor: {
      Program(programPath, state) {
        const filename = state.filename ?? state.file?.opts?.filename;
        if (!filename || typeof filename !== 'string') {
          programPath.skip();
          return;
        }

        const rel = path
          .relative(REPO_ROOT, filename)
          .split(path.sep)
          .join('/');

        programPath.traverse({
          JSXOpeningElement(jsxPath) {
            const source = resolveImportSource(jsxPath.node.name, jsxPath);
            if (!isAllowedSource(source, filename)) return;

            const line = jsxPath.node.loc?.start.line;
            if (line == null) return;

            const srcValue = `${rel}:${line}`;
            const attrs = jsxPath.node.attributes;
            let existingIdx = -1;
            for (let i = 0; i < attrs.length; i++) {
              const attr = attrs[i];
              if (
                attr.type === 'JSXAttribute' &&
                attr.name.type === 'JSXIdentifier' &&
                attr.name.name === 'dataSet'
              ) {
                existingIdx = i;
                break;
              }
            }

            const srcProp = t.objectProperty(
              t.identifier('src'),
              t.stringLiteral(srcValue)
            );

            if (existingIdx >= 0) {
              const existing = attrs[existingIdx];
              if (
                existing.type === 'JSXAttribute' &&
                existing.value?.type === 'JSXExpressionContainer' &&
                existing.value.expression.type === 'ObjectExpression'
              ) {
                const props = existing.value.expression.properties.filter(
                  (p) =>
                    !(
                      p.type === 'ObjectProperty' &&
                      ((p.key.type === 'Identifier' && p.key.name === 'src') ||
                        (p.key.type === 'StringLiteral' &&
                          p.key.value === 'src'))
                    )
                );
                props.push(srcProp);
                existing.value.expression.properties = props;
              } else if (existing.type === 'JSXAttribute') {
                const prevExpr =
                  existing.value?.type === 'JSXExpressionContainer'
                    ? existing.value.expression
                    : t.objectExpression([]);
                existing.value = t.jsxExpressionContainer(
                  t.objectExpression([
                    t.spreadElement(
                      t.logicalExpression(
                        '||',
                        prevExpr,
                        t.objectExpression([])
                      )
                    ),
                    srcProp,
                  ])
                );
              }
            } else {
              // Insert FIRST so later `{...componentDataSet(...)}` spreads win.
              attrs.unshift(
                t.jsxAttribute(
                  t.jsxIdentifier('dataSet'),
                  t.jsxExpressionContainer(t.objectExpression([srcProp]))
                )
              );
            }
          },
        });
      },
    },
  };
};
