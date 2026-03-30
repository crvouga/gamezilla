FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock ./
COPY aws/package.json ./aws/
COPY patch-db-app/package.json ./patch-db-app/
RUN bun install --frozen-lockfile --production
COPY src/ ./src/
COPY tsconfig.json ./
ENV PORT=8080
EXPOSE 8080
CMD ["bun", "run", "src/sync-server.ts"]
