# Glob match

Build tools use `any` for source exclusions, `capture` for catalog locales,
and `makeRe` for watcher ignores. Picomatch compiles these patterns without
the recursive `braces` dependency. Nesting above 64 levels is rejected before
regular expression compilation.

The root `micromatch` override selects this implementation for Lingui and
Parcel's watcher. This deliberately supports their three operations; it is
not a general replacement for every Micromatch API. Native CommonJS lets
Node load it without stripping TypeScript in `node_modules`.

The root workspace dependency puts this package's sources in Turbo's global
hash, so changing the implementation invalidates the build tools' cached work.
After editing it, run `bun install --force` to refresh Bun's file dependency
copy before running the catalog and Tailwind checks.
