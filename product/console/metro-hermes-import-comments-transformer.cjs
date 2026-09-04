/**
 * Hermes has no working `import()`. Metro leaves many node_modules
 * `import()` calls untransformed, so `import(...).then(...)` becomes
 * `.then` of undefined (`[runtime not ready]`).
 */
'use strict';

const upstream = require(
  process.env.GAMEZILLA_METRO_UPSTREAM_BABEL_TRANSFORMER
);
const {
  prepareHermesImportSrc,
} = require('./metro-hermes-dynamic-import-rewrite.cjs');

exports.transform = function transform(config) {
  const src =
    typeof config.src === 'string'
      ? prepareHermesImportSrc(
          config.src,
          config.options?.platform,
          config.filename
        )
      : config.src;
  return upstream.transform({ ...config, src });
};

exports.getCacheKey = function getCacheKey() {
  const upstreamKey =
    typeof upstream.getCacheKey === 'function' ? upstream.getCacheKey() : '';
  return `hermes-import-rewrite-v5:${upstreamKey}`;
};
