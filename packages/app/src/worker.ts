/**
 * MQTT worker (referee / shared subscription). Game logic TBD.
 */
import { assert } from '@gamezilla/shared/assert';
import { NodeCrashHandler } from '@gamezilla/shared/assert/crash/crash-handler/crash-handler-node';
import { connectAsync, type MqttClient } from 'mqtt';
import { resolveDatabaseUrl } from './database-url';

assert.registerCrashHandler(new NodeCrashHandler());

const PORT = parseInt(process.env['PORT'] ?? '8081');
assert.integer(PORT, 'PORT must be an integer');

const databaseUrl = resolveDatabaseUrl();
if (databaseUrl === undefined) {
  console.warn(
    '[worker] DATABASE_URL / DATABASE_HOST not set; worker will not persist to Postgres yet'
  );
}

const pubSubUrl = process.env['PUBSUB_URL'];
assert.ok(
  pubSubUrl !== undefined && pubSubUrl !== '',
  'PUBSUB_URL is required for worker'
);

const mqtt: MqttClient = await connectAsync(pubSubUrl);

/** Shared group for competing consumers (see GAME_ARCHITECTURE.md). */
const WORKER_COMMANDS_TOPIC = '$share/workers/games/+/commands';

void mqtt.subscribeAsync(WORKER_COMMANDS_TOPIC, { qos: 0 });

mqtt.on('message', (topic, payload) => {
  let body: unknown;
  try {
    body = JSON.parse(payload.toString());
  } catch {
    body = payload.toString();
  }
  console.log('[worker] message', { topic, body });
});

Bun.serve({
  hostname: '0.0.0.0',
  port: Number(PORT),
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/health') {
      return new Response('ok', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
    return new Response('Not Found', { status: 404 });
  },
});

console.log(
  `[worker] Listening on http://localhost:${PORT} health; MQTT ${pubSubUrl} subscribed ${WORKER_COMMANDS_TOPIC}`
);
