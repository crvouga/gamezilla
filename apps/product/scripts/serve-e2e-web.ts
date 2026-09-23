// @io-wall-ok — web server for the full-system `localhost` profile (`bun e2e`).
/**
 * Serves the E2E client build on the pinned web origin. The bundle talks to
 * the real API Worker directly; only the Dev IdP popup is answered here, by
 * completing the chooser against the Worker for the requesting actor.
 */

import { startPreviewWebServer } from '../../client/scripts/preview-web-server';
import {
  completeDevAuthSession,
  isDevAuthSessionRequest,
} from '../src/sim/hosts/dev-auth-session';
import { ACTOR_HEADER } from '../src/sim/hosts/localhost-http';

const port = Number(process.env['PREVIEW_PORT'] ?? '5173');

const server = startPreviewWebServer({
  port,
  intercept: async (req) => {
    if (!isDevAuthSessionRequest(req)) return null;
    const subject = req.headers.get(ACTOR_HEADER);
    if (subject === null || subject === '') {
      return new Response(`${ACTOR_HEADER} required`, { status: 400 });
    }
    return completeDevAuthSession(
      req,
      (input, init) => fetch(input, init),
      subject
    );
  },
});
if (server.port !== port) {
  server.stop(true);
  throw new Error(
    `e2e web origin needs :${String(port)} (Worker OAuth return)`
  );
}
process.stdout.write(`[e2e-web] static web=${server.url.origin}\n`);
