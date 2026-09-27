export type PubsubEmqxSecretValidateInput = {
  readonly secretValue: string;
};

export type PubsubEmqxSecretDef = {
  readonly name: string;
  readonly hint: string;
  readonly optional?: boolean;
  readonly pushToApiWorker?: boolean;
  validate(input: PubsubEmqxSecretValidateInput): Promise<void>;
};

function requireNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
}

function requireHttpsUrl(value: string, label: string): void {
  const v = value.trim();
  requireNonEmpty(v, label);
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`${label} must use https://`);
  }
}

async function validateEmqxApiUrl(
  input: PubsubEmqxSecretValidateInput
): Promise<void> {
  const v = input.secretValue.trim();
  if (v.length === 0) return;
  requireHttpsUrl(v, 'EMQX_API_URL');
}

async function validateEmqxWssUrl(
  input: PubsubEmqxSecretValidateInput
): Promise<void> {
  const v = input.secretValue.trim();
  if (v.length === 0) return;
  if (!v.startsWith('wss://') && !v.startsWith('ws://')) {
    throw new Error('EMQX_WSS_URL must start with wss:// or ws://');
  }
}

async function validateNonEmpty(
  name: string,
  input: PubsubEmqxSecretValidateInput
): Promise<void> {
  if (input.secretValue.trim().length === 0) return;
  requireNonEmpty(input.secretValue, name);
}

/**
 * Secret definitions for the registry. Callers wrap these with their
 * `Secret` class (`@libs/secrets`). Every value is written per environment by
 * OpenTofu (`libs/infra/tofu/modules/pubsub` + `secrets`).
 */
export const pubsubEmqxSecretDefs: readonly PubsubEmqxSecretDef[] = [
  {
    name: 'EMQX_API_URL',
    hint: 'https://<broker host> — EMQX HTTP API (via Caddy)',
    optional: true,
    pushToApiWorker: true,
    validate: validateEmqxApiUrl,
  },
  {
    name: 'EMQX_WSS_URL',
    hint: 'wss://<broker host>/mqtt — the API Worker materializes it into synced client_config',
    optional: true,
    pushToApiWorker: true,
    validate: validateEmqxWssUrl,
  },
  {
    name: 'EMQX_API_KEY',
    hint: 'EMQX dashboard API key (Basic auth username)',
    optional: true,
    pushToApiWorker: true,
    validate: (i) => validateNonEmpty('EMQX_API_KEY', i),
  },
  {
    name: 'EMQX_API_SECRET',
    hint: 'EMQX dashboard API secret (Basic auth password)',
    optional: true,
    pushToApiWorker: true,
    validate: (i) => validateNonEmpty('EMQX_API_SECRET', i),
  },
  {
    name: 'EMQX_JWT_SECRET',
    hint: 'HMAC secret shared with EMQX JWT authenticator (MQTT password = JWT)',
    optional: true,
    pushToApiWorker: true,
    validate: (i) => validateNonEmpty('EMQX_JWT_SECRET', i),
  },
  {
    name: 'EMQX_DASHBOARD_PASSWORD',
    hint: 'EMQX dashboard `admin` password; set on every broker boot. Never on a Worker.',
    optional: true,
    pushToApiWorker: false,
    validate: (i) => validateNonEmpty('EMQX_DASHBOARD_PASSWORD', i),
  },
];
