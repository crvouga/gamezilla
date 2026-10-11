FROM oven/bun:1.4.2
WORKDIR /app
COPY . .
ENV ONNXRUNTIME_NODE_INSTALL=skip
# `--ignore-scripts` skips the root postinstall, so its generated sources are built here.
RUN bun install --frozen-lockfile --ignore-scripts && bun run generate
RUN mkdir -p pkgs/bun-test-solid-client/node_modules/.cache && chown -R bun:bun /app
USER bun
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=6s --start-period=120s --retries=3 CMD ["bun", "apps/synthetic-population-worker/scripts/health.ts"]
CMD ["bun", "--conditions=browser", "--conditions=development", "apps/synthetic-population-worker/src/main.ts"]
