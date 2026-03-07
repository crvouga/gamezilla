import { createPatchDbHttpHandlers } from "@/@shared/patch-db/impl-http";
import { PatchDbImplSqlite } from "@/@shared/patch-db/impl-sqlite/impl-sqlite";
import { SqlClientImplBunSqlite } from "@/@shared/sql-client/impl-bun-sqlite";

const PORT = process.env.PORT ?? 5001;

const sqlClient = SqlClientImplBunSqlite.open(":memory:");
await sqlClient.connect();

const patchDb = new PatchDbImplSqlite(sqlClient);
await patchDb.migrate();

const patchDbHandler = createPatchDbHttpHandlers(patchDb);

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

function withCors(res: Response): Response {
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
        headers.set(k, v);
    }
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

const server = Bun.serve({
    port: Number(PORT),
    fetch(req: Request) {
        const url = new URL(req.url);

        if (req.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        if (url.pathname === "/health") {
            return withCors(new Response("ok", { status: 200, headers: { "Content-Type": "text/plain" } }));
        }

        if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/patches-db/")) {
            return patchDbHandler(req).then(withCors);
        }

        return withCors(new Response("Not Found", { status: 404, headers: { "Content-Type": "text/plain" } }));
    },
});

console.log(`Server running at http://localhost:${server.port}`);
