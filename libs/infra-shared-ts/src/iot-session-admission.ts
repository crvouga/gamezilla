import {
  authorize,
  iotWireTopic,
} from '../tofu/modules/pubsub/authorizer/index.mjs';

/**
 * What AWS IoT does with a browser that connects: the deployed authorizer
 * (`tofu/modules/pubsub/authorizer`) turns the app's token into session
 * policy documents, and IoT checks every connect, subscribe, publish and
 * delivery against them. This runs that same authorizer and the same checks
 * so a broker on a laptop or a CI runner refuses what IoT would.
 */

const REGION = 'us-east-1';
const ACCOUNT_ID = '000000000000';

type Statement = {
  readonly Effect: string;
  readonly Action: string | readonly string[];
  readonly Resource: string | readonly string[];
};
type PolicyDocument = { readonly Statement: readonly Statement[] };

export type IotSessionAccess = {
  canSubscribe(topic: string): boolean;
  canPublish(topic: string): boolean;
  canReceive(topic: string): boolean;
};

export type IotAdmission =
  | { readonly kind: 'refused' }
  | { readonly kind: 'limited'; readonly access: IotSessionAccess };

function list(value: string | readonly string[]): readonly string[] {
  return typeof value === 'string' ? [value] : value;
}

/** IoT resource matching: `*` is any run of characters, `?` any one. */
function matches(pattern: string, value: string): boolean {
  const source = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replaceAll('*', '.*')
    .replaceAll('?', '.');
  return new RegExp(`^${source}$`).test(value);
}

function allows(
  documents: readonly PolicyDocument[],
  action: string,
  resource: string
): boolean {
  const statements = documents.flatMap((document) => document.Statement);
  const applies = (statement: Statement) =>
    list(statement.Action).some((candidate) => matches(candidate, action)) &&
    list(statement.Resource).some((candidate) => matches(candidate, resource));
  if (
    statements.some(
      (statement) => statement.Effect === 'Deny' && applies(statement)
    )
  ) {
    return false;
  }
  return statements.some(
    (statement) => statement.Effect === 'Allow' && applies(statement)
  );
}

function arn(kind: string, name: string): string {
  return `arn:aws:iot:${REGION}:${ACCOUNT_ID}:${kind}/${name}`;
}

/**
 * Admit a client the way IoT does. The password is the app's token; its
 * lifetime is judged at `nowSec`.
 */
export function admitIotClient(input: {
  readonly tokenSecret: string;
  readonly nowSec: number;
  readonly clientId: string;
  readonly password: string | undefined;
}): IotAdmission {
  const result = authorize(
    {
      protocolData: {
        mqtt: { clientId: input.clientId, password: input.password },
      },
    },
    {
      tokenSecret: input.tokenSecret,
      region: REGION,
      accountId: ACCOUNT_ID,
      nowSec: input.nowSec,
    }
  );
  const documents = (result.policyDocuments ?? []) as PolicyDocument[];
  if (
    !result.isAuthenticated ||
    !allows(documents, 'iot:Connect', arn('client', input.clientId))
  ) {
    return { kind: 'refused' };
  }
  return {
    kind: 'limited',
    access: {
      canSubscribe: (topic) =>
        allows(
          documents,
          'iot:Subscribe',
          arn('topicfilter', iotWireTopic(topic))
        ),
      canPublish: (topic) =>
        allows(documents, 'iot:Publish', arn('topic', iotWireTopic(topic))),
      canReceive: (topic) =>
        allows(documents, 'iot:Receive', arn('topic', iotWireTopic(topic))),
    },
  };
}
