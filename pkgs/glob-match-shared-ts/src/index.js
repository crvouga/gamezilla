const picomatch = require('picomatch');

/** @typedef {import('picomatch').PicomatchOptions & { lookbehinds?: boolean }} GlobOptions */

/**
 * Bound nesting before compiling a regular expression. Build configuration
 * needs only shallow braces; adversarial nesting must never reach the engine.
 * @param {string} pattern
 */
function validatePattern(pattern) {
  let depth = 0;
  let escaped = false;
  for (const character of pattern) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') escaped = true;
    else if (character === '{' || character === '(' || character === '[') {
      depth += 1;
      if (depth > 64) throw new TypeError('Glob nesting exceeds 64 levels');
    } else if (character === '}' || character === ')' || character === ']') {
      depth = Math.max(0, depth - 1);
    }
  }
}

/**
 * @param {string} input
 * @param {string | readonly string[]} patterns
 * @param {GlobOptions} [options]
 */
function any(input, patterns, options) {
  const globs = typeof patterns === 'string' ? [patterns] : patterns;
  return globs.some((pattern) => {
    validatePattern(pattern);
    return picomatch(pattern, options)(input);
  });
}

/** @param {string} pattern @param {GlobOptions} [options] */
function makeRe(pattern, options) {
  validatePattern(pattern);
  return picomatch.makeRe(pattern, options);
}

/**
 * @param {string} pattern
 * @param {string} input
 * @param {GlobOptions} [options]
 */
function capture(pattern, input, options) {
  const match = makeRe(pattern, { ...options, capture: true }).exec(input);
  return match ? match.slice(1).map((value) => value ?? '') : null;
}

// Native JavaScript lets Node-based build tools load this package without a
// TypeScript loader. These are the operations used by catalogs and watchers.
exports.any = any;
exports.capture = capture;
exports.makeRe = makeRe;
