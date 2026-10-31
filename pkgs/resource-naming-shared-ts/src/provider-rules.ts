/**
 * What each provider accepts as a resource name. A rule is the provider's
 * documented limit; a resource kind not listed here is not named by
 * `resourceName` (add its rule first).
 */
export type ProviderRule = {
  readonly minLength: number;
  readonly maxLength: number;
  /** Every character the provider accepts. */
  readonly allowed: RegExp;
  /** The first and last character must match this. */
  readonly edge: RegExp;
  /** The provider folds case or refuses upper case. */
  readonly lowercase: boolean;
  /**
   * Names share one namespace across every account (S3 buckets): a new one
   * needs a stable scope (`uniqueIn`) so two deployments never collide.
   */
  readonly globallyUnique: boolean;
};

const DNS_LABEL: ProviderRule = {
  minLength: 1,
  maxLength: 63,
  allowed: /^[a-z0-9-]+$/,
  edge: /^[a-z0-9]$/,
  lowercase: true,
  globallyUnique: false,
};

export const PROVIDER_RULES = {
  /** A DNS label (one part of a hostname). */
  'dns-label': DNS_LABEL,
  /** Cloudflare Workers script name. */
  'cloudflare-worker': DNS_LABEL,
  /** Cloudflare R2 bucket. */
  'cloudflare-r2-bucket': { ...DNS_LABEL, minLength: 3 },
  /** Cloudflare Hyperdrive configuration. */
  'cloudflare-hyperdrive': DNS_LABEL,
  /** Amazon S3 bucket (one namespace across every account). */
  'aws-s3-bucket': {
    minLength: 3,
    maxLength: 63,
    allowed: /^[a-z0-9.-]+$/,
    edge: /^[a-z0-9]$/,
    lowercase: true,
    globallyUnique: true,
  },
  /** AWS IAM role or user. */
  'aws-iam-role': {
    minLength: 1,
    maxLength: 64,
    allowed: /^[A-Za-z0-9+=,.@_-]+$/,
    edge: /^[A-Za-z0-9+=,.@_-]$/,
    lowercase: false,
    globallyUnique: false,
  },
  /** AWS Lambda function. */
  'aws-lambda-function': {
    minLength: 1,
    maxLength: 64,
    allowed: /^[A-Za-z0-9_-]+$/,
    edge: /^[A-Za-z0-9_-]$/,
    lowercase: false,
    globallyUnique: false,
  },
  /** AWS IoT Core custom authorizer or domain configuration. */
  'aws-iot-authorizer': {
    minLength: 1,
    maxLength: 128,
    allowed: /^[A-Za-z0-9_=,@-]+$/,
    edge: /^[A-Za-z0-9_=,@-]$/,
    lowercase: false,
    globallyUnique: false,
  },
  /** Grafana folder or dashboard uid. */
  'grafana-uid': {
    minLength: 1,
    maxLength: 40,
    allowed: /^[A-Za-z0-9_-]+$/,
    edge: /^[A-Za-z0-9]$/,
    lowercase: false,
    globallyUnique: false,
  },
  /** Railway project, environment or service. */
  'railway-name': DNS_LABEL,
} as const satisfies Record<string, ProviderRule>;

export type ResourceKind = keyof typeof PROVIDER_RULES;
