/** Satisfies static `require("fs")` in sql.js when bundling for browser (dead at runtime). */
module.exports = {
  readFileSync() {
    throw new Error('fs.readFileSync is not available in browser worker bundle');
  },
  readFile(_path, _opts, cb) {
    if (typeof cb === 'function') {
      cb(new Error('fs.readFile is not available in browser worker bundle'));
    }
  },
};
