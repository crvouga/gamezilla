// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EMQX_API_KEY,
  EMQX_API_SECRET,
  EMQX_MQTT_PASS,
  EMQX_MQTT_USER,
} from '../src/ports';

const APP_DIR = join(import.meta.dirname, '..');
const DATA_DIR = join(APP_DIR, 'data');
const ETC_DIR = join(DATA_DIR, 'etc');

function ensureBootstrap(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(ETC_DIR, { recursive: true });

  const bootstrap = join(DATA_DIR, 'api-keys.bootstrap');
  writeFileSync(bootstrap, `${EMQX_API_KEY}:${EMQX_API_SECRET}\n`, 'utf8');

  const confSrc = join(APP_DIR, 'config', 'emqx.conf');
  const confDest = join(ETC_DIR, 'emqx.conf');
  copyFileSync(confSrc, confDest);

  // Built-in auth user bootstrap (CSV: user:password) for password_based.
  const users = join(DATA_DIR, 'auth-built-in-db-bootstrap.csv');
  if (!existsSync(users)) {
    writeFileSync(
      users,
      `${EMQX_MQTT_USER}:{plain}${EMQX_MQTT_PASS}\n`,
      'utf8'
    );
  }
}

ensureBootstrap();
process.stdout.write('[emqx] local configuration ready\n');
