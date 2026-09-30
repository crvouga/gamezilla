export type PubsubIotSecretValidateInput = {
  readonly secretValue: string;
};

export type PubsubIotSecretDef = {
  readonly name: string;
  readonly hint: string;
  readonly optional?: boolean;
  readonly pushToApiWorker?: boolean;
  validate(input: PubsubIotSecretValidateInput): Promise<void>;
};

function requireNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
}

async function validateNonEmpty(
  name: string,
  input: PubsubIotSecretValidateInput
): Promise<void> {
  if (input.secretValue.trim().length === 0) return;
  requireNonEmpty(input.secretValue, name);
}

/**
 * Worker publish credentials for AWS IoT Core. OpenTofu derives them from
 * the publisher IAM user. Absent on a laptop: local brokers use EMQX.
 */
export const pubsubIotSecretDefs: readonly PubsubIotSecretDef[] = [
  {
    name: 'IOT_DATA_ENDPOINT',
    hint: 'AWS IoT data-plane hostname (no scheme). The API Worker signs publishes to https://<endpoint>/topics/…',
    optional: true,
    pushToApiWorker: true,
    validate: (i) => validateNonEmpty('IOT_DATA_ENDPOINT', i),
  },
  {
    name: 'IOT_ACCESS_KEY_ID',
    hint: 'IAM access key the API Worker uses to publish invalidations. OpenTofu mints it.',
    optional: true,
    pushToApiWorker: true,
    validate: (i) => validateNonEmpty('IOT_ACCESS_KEY_ID', i),
  },
  {
    name: 'IOT_SECRET_ACCESS_KEY',
    hint: 'IAM secret paired with IOT_ACCESS_KEY_ID.',
    optional: true,
    pushToApiWorker: true,
    validate: (i) => validateNonEmpty('IOT_SECRET_ACCESS_KEY', i),
  },
  {
    name: 'IOT_REGION',
    hint: 'AWS region of the IoT data plane (SigV4).',
    optional: true,
    pushToApiWorker: true,
    validate: (i) => validateNonEmpty('IOT_REGION', i),
  },
];
