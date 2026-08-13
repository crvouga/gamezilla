# `@pkgs/system-console`

Capture system/DST timelines into an ObjectStore and browse them in a local SPA.

```bash
bun run --filter @pkgs/system-console dev
```

Serves the API + React SPA with Bun's HTML bundler and HMR (no prebuild). Optional static build: `bun run --filter @pkgs/system-console build` → `dist/`.

Local artifacts land in `<repo>/system-console-data` (gitignored).
