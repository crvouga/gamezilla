# Agent Notes

## CI / Turbo Remote Cache

GitHub Actions runs checks with `DOPPLER_CONFIG=local`. For Turbo Remote Cache hits in CI, ensure the Doppler **`local`** config defines `TURBO_API`, `TURBO_TOKEN`, `TURBO_TEAM`, and `TURBO_CACHE` (e.g. `remote:rw`). See `apps/infra/src/cli/secrets/turbo-token.ts` for hints.
