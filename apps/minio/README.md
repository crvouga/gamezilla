# `@apps/minio`

Local MinIO (S3-compatible) for non-production (`SECRETS_ENV=dev`). Turbo starts this package alongside `@apps/api` / `@apps/client` for `bun dev` and `bun preview`.

Production (`SECRETS_ENV=prd`) continues to use Infisical → Backblaze B2 — this app is never deployed.

## Local

| | |
| --- | --- |
| S3 API | `http://127.0.0.1:9000` |
| Console | `http://127.0.0.1:9001` |
| Access key / secret | `minioadmin` / `minioadmin` |
| Bucket | `local` |
| Region | `us-east-1` |
| Data dir | `apps/minio/data` (gitignored) |

`@apps/api` `setup` always writes these values into `.dev.vars` as `B2_APP_KEY_ID` / `B2_APP_KEY` / `S3_BUCKET` / `S3_ENDPOINT` / `S3_REGION`.

Binary resolution: `MINIO_BIN` → PATH / Homebrew → pinned download under `.cache/`.

## Commands

```bash
bun run --filter @apps/minio setup
bun run --filter @apps/minio dev
```

Hard reset: stop the stack, `rm -rf apps/minio/data`, then `bun dev`.

Ctrl-C / `bun kill` tears down the process and reclaims ports `9000` / `9001`.
