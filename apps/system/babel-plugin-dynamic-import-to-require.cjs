/**
 * Jest helper: rewrite `import(source)` → Promise that `require`s and
 * interops CJS/ESM default exports so named destructuring works
 * (e.g. better-auth's `const { createKyselyAdapter } = await import(...)`).
 */
module.exports = function babelPluginDynamicImportToRequire({ types: t }) {
  return {
    name: 'dynamic-import-to-require',
    visitor: {
      CallExpression(path) {
        if (path.node.callee.type !== 'Import') return;
        // Promise.resolve(require(source)).then((m) => ({
        //   ...(m && m.default && typeof m.default === 'object' ? m.default : {}),
        //   ...m,
        // }))
        const required = t.callExpression(
          t.identifier('require'),
          path.node.arguments
        );
        const m = t.identifier('m');
        const interop = t.arrowFunctionExpression(
          [m],
          t.objectExpression([
            t.spreadElement(
              t.conditionalExpression(
                t.logicalExpression(
                  '&&',
                  t.logicalExpression(
                    '&&',
                    m,
                    t.memberExpression(m, t.identifier('default'))
                  ),
                  t.binaryExpression(
                    '===',
                    t.unaryExpression(
                      'typeof',
                      t.memberExpression(m, t.identifier('default'))
                    ),
                    t.stringLiteral('object')
                  )
                ),
                t.memberExpression(m, t.identifier('default')),
                t.objectExpression([])
              )
            ),
            t.spreadElement(m),
          ])
        );
        path.replaceWith(
          t.callExpression(
            t.memberExpression(
              t.callExpression(
                t.memberExpression(
                  t.identifier('Promise'),
                  t.identifier('resolve')
                ),
                [required]
              ),
              t.identifier('then')
            ),
            [interop]
          )
        );
      },
    },
  };
};
