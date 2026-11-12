/**
 * `using` and `await using` look an object's cleanup up by `Symbol.dispose`
 * and `Symbol.asyncDispose`. Safari has neither symbol. The build rewrites
 * the declarations for it, and that rewrite reads `Symbol.for('Symbol.dispose')`
 * when the symbol is missing, but an object that declares
 * `[Symbol.dispose]() {}` is then keyed by `undefined`, so the two never
 * meet and every `using` throws "Object is not disposable". Giving the
 * symbols the values the rewrite expects makes both sides agree.
 */
export function polyfillDisposal(): void {
  for (const name of ['dispose', 'asyncDispose'] as const) {
    if (typeof Symbol[name] === 'symbol') continue;
    Object.defineProperty(Symbol, name, {
      value: Symbol.for(`Symbol.${name}`),
      configurable: true,
      enumerable: false,
      writable: false,
    });
  }
}
