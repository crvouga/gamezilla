/** Satisfies static `require("path")` in sql.js when bundling for browser (dead at runtime). */
module.exports = {
  dirname() {
    return '/';
  },
  normalize(p) {
    return p;
  },
  join(...parts) {
    return parts.join('/');
  },
};
