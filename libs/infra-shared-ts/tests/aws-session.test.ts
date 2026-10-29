import { describe, expect, test } from 'bun:test';
import {
  accountKeySession,
  awsAuthPlan,
  githubOidcUrl,
  parseAwsEnvCredentials,
  parseStsCredentials,
  stsSessionName,
} from '@libs/infra-shared-ts/aws-session';
import { technicalName } from '@libs/product-identity-shared-ts/technical-names';

const oidcEnv = {
  AWS_ROLE_ARN: 'arn:aws:iam::111111111111:role/example-github-deploy',
  ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.test/token?ref=1',
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'gha-token',
};

describe('awsAuthPlan', () => {
  test('uses GitHub OIDC ahead of stored account keys', () => {
    expect(
      awsAuthPlan(
        {
          ...oidcEnv,
          AWS_ACCOUNT_ACCESS_KEY_ID: 'AKIA',
          AWS_ACCOUNT_SECRET_ACCESS_KEY: 'secret',
        },
        'foundation'
      )
    ).toBe('oidc');
  });

  test('uses account keys when no OIDC request is available', () => {
    expect(
      awsAuthPlan(
        {
          AWS_ACCOUNT_ACCESS_KEY_ID: 'AKIA',
          AWS_ACCOUNT_SECRET_ACCESS_KEY: 'secret',
          GITHUB_ACTIONS: 'true',
        },
        'bootstrap'
      )
    ).toBe('account-keys');
  });

  test('does not shell out to the AWS CLI on a runner with no role', () => {
    expect(awsAuthPlan({ GITHUB_ACTIONS: 'true' }, 'foundation')).toBe('none');
  });

  test('uses the local AWS CLI otherwise', () => {
    expect(awsAuthPlan({}, 'foundation')).toBe('local');
  });

  test('skips stacks that do not talk to AWS', () => {
    expect(awsAuthPlan(oidcEnv, 'edge')).toBe('none');
    expect(awsAuthPlan(oidcEnv, 'fleet')).toBe('none');
  });

  test('treats a blank role as absent', () => {
    expect(awsAuthPlan({ ...oidcEnv, AWS_ROLE_ARN: '  ' }, 'foundation')).toBe(
      'local'
    );
  });
});

describe('accountKeySession', () => {
  test('prefers the account names over AWS_ACCESS_KEY_ID', () => {
    expect(
      accountKeySession({
        AWS_ACCOUNT_ACCESS_KEY_ID: 'account-id',
        AWS_ACCOUNT_SECRET_ACCESS_KEY: 'account-secret',
        AWS_ACCESS_KEY_ID: 'state-id',
        AWS_SECRET_ACCESS_KEY: 'state-secret',
        AWS_SESSION_TOKEN: 'token',
      })
    ).toEqual({
      accessKeyId: 'account-id',
      secretAccessKey: 'account-secret',
      sessionToken: 'token',
    });
  });

  test('returns null when only one side of a pair is set', () => {
    expect(
      accountKeySession({ AWS_ACCOUNT_ACCESS_KEY_ID: 'account-id' })
    ).toBeNull();
  });
});

describe('githubOidcUrl', () => {
  test('sets the STS audience without dropping an existing query', () => {
    expect(githubOidcUrl('https://example.test/token?ref=1')).toBe(
      'https://example.test/token?ref=1&audience=sts.amazonaws.com'
    );
  });
});

describe('stsSessionName', () => {
  test('uses the Actions run id when it is digits', () => {
    expect(stsSessionName({ GITHUB_RUN_ID: '36783735329' })).toBe(
      'gha-36783735329'
    );
  });

  test('falls back to the namespace when the run id is missing', () => {
    expect(stsSessionName({})).toBe(technicalName(['tofu']));
    expect(stsSessionName({ GITHUB_RUN_ID: 'not-a-run' })).toBe(
      technicalName(['tofu'])
    );
  });
});

describe('parseAwsEnvCredentials', () => {
  test('reads env-no-export and quoted export lines', () => {
    expect(
      parseAwsEnvCredentials(
        [
          'AWS_ACCESS_KEY_ID=ASIAEXAMPLE',
          "export AWS_SECRET_ACCESS_KEY='session-secret'",
          'AWS_SESSION_TOKEN="session-token"',
        ].join('\n')
      )
    ).toEqual({
      accessKeyId: 'ASIAEXAMPLE',
      secretAccessKey: 'session-secret',
      sessionToken: 'session-token',
    });
  });

  test('returns null when the secret is missing', () => {
    expect(
      parseAwsEnvCredentials('AWS_ACCESS_KEY_ID=ASIAEXAMPLE\n')
    ).toBeNull();
  });
});

describe('parseStsCredentials', () => {
  test('reads the credentials element', () => {
    expect(
      parseStsCredentials(
        '<Credentials><AccessKeyId>ASIA</AccessKeyId><SecretAccessKey>sec</SecretAccessKey><SessionToken>tok</SessionToken></Credentials>'
      )
    ).toEqual({
      accessKeyId: 'ASIA',
      secretAccessKey: 'sec',
      sessionToken: 'tok',
    });
  });

  test('surfaces the STS error message', () => {
    expect(() =>
      parseStsCredentials('<Error><Message>Not authorized</Message></Error>')
    ).toThrow('Not authorized');
  });

  test('does not echo a body that has no message', () => {
    expect(() => parseStsCredentials('nope')).toThrow(
      'returned no credentials'
    );
  });
});
