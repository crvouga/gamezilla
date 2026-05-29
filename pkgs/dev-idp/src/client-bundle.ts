/**
 * Builds the browser JavaScript bundle for the dev IdP chooser. The
 * entry point ({@link ./ui/client/client-entry.tsx}) and its component
 * graph are compiled with `Bun.build` targeting modern browsers — the
 * resulting ESM module is served verbatim by the standalone IdP server
 * at `/dev-idp/client.js` (see {@link ./oauth2-router}).
 *
 * Bundling at server-startup keeps the dev-idp package free of any
 * separate build step: `bun run src/dev.ts` works in one shot, no
 * pre-build, no watch loop. The output is cached in memory and reused
 * across every page render of the same process.
 */
import { fileURLToPath } from 'node:url';

const ENTRY_URL = new URL('./ui/client/client-entry.tsx', import.meta.url);

export type ClientBundle = {
  /** JavaScript module text served at `/dev-idp/client.js`. */
  readonly js: string;
  /** Size in bytes (after build, before transport encoding). */
  readonly bytes: number;
};

/**
 * Builds the client bundle once. Throws with a structured message when
 * the build fails — callers (`dev-server.ts`) should let the process
 * exit so the developer sees the error rather than serving a stale or
 * empty bundle.
 */
export async function buildClientBundle(): Promise<ClientBundle> {
  const entryPath = fileURLToPath(ENTRY_URL.href);
  const result = await Bun.build({
    entrypoints: [entryPath],
    target: 'browser',
    format: 'esm',
    minify: {
      whitespace: true,
      syntax: true,
      identifiers: true,
    },
    sourcemap: 'inline',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  if (!result.success) {
    const lines: string[] = [];
    for (const log of result.logs) {
      const msg =
        typeof log === 'object' && log !== null && 'message' in log
          ? String((log as { message: unknown }).message)
          : String(log);
      lines.push(msg);
    }
    throw new Error(
      `dev-idp: client bundle build failed:\n${lines.join('\n')}`
    );
  }

  const output = result.outputs[0];
  if (output === undefined) {
    throw new Error('dev-idp: client bundle build produced no outputs');
  }
  const js = await output.text();
  return { js, bytes: js.length };
}
