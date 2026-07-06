import { resolveLocalApiOrigin, waitForHttpOk } from '../src/harness';

const timeoutMs = Number(process.env['API_HEALTH_WAIT_MS'] ?? '120_000');
const origin = await resolveLocalApiOrigin();
const healthUrl = `${origin}/api/health`;

await waitForHttpOk(healthUrl, {
  timeoutMs,
  label: 'API /api/health',
});

process.stdout.write(`[wait-for-api-health] ready ${healthUrl}\n`);
