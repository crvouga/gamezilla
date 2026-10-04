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
 * `Secret` class (`@libs/secrets`). OpenTofu writes both per environment.
 * The HMAC secret signs client tokens; the authorizer on AWS IoT Core checks
 * the same secret. Local EMQX sidecars still use it. The WSS URL is what
 * clients connect to (`client_config.emqx_wss_url`).
 */
export const pubsubEmqxSecretDefs: readonly PubsubEmqxSecretDef[] = [
  {
    name: 'EMQX_WSS_URL',
    hint: 'wss://<broker host>/mqtt — the API Worker materializes it into synced client_config',
    optional: true,
    pushToApiWorker: true,
    validate: validateEmqxWssUrl,
  },
  {
    name: 'EMQX_JWT_SECRET',
    hint: 'HMAC secret for client MQTT tokens. The IoT authorizer verifies it; local EMQX does too.',
    optional: true,
    pushToApiWorker: true,
    validate: (i) => validateNonEmpty('EMQX_JWT_SECRET', i),
  },
];
