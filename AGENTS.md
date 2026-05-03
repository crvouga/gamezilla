# Agent Notes

## Hard Rules

- **Never patch dependencies.** Do not use `bun patch`, `patch-package`, `pnpm patch`, or any other dependency-patching mechanism. Do not add a `patches/` directory or a `patchedDependencies` / `pnpm.patchedDependencies` / `resolutions` field to `package.json`. If a third-party library has a bug, work around it in our own code or accept the behavior — never fork the dep in-tree. CI enforces this via `bun run check:no-patches`.

## CI / Turbo Remote Cache

GitHub Actions runs checks with `DOPPLER_CONFIG=local`. For Turbo Remote Cache hits in CI, ensure the Doppler **`local`** config defines `TURBO_API`, `TURBO_TOKEN`, `TURBO_TEAM`, and `TURBO_CACHE` (e.g. `remote:rw`). See `apps/infra/src/cli/secrets/turbo-token.ts` for hints.
