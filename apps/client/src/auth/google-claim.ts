import { createApiClient } from '@gamezilla/client/api/hc';
import { assert } from '@gamezilla/lib/assert';

export type GoogleClaimSuccess = {
  accountId: string;
  sessionToken: string;
  expiresAt: string;
  sessionEntityId: string;
};

function parseClaimResponse(json: unknown): GoogleClaimSuccess {
  assert.record(json, 'claim response must be object');
  const accountId = json['accountId'];
  const sessionToken = json['sessionToken'];
  const expiresAt = json['expiresAt'];
  const sessionEntityId = json['sessionEntityId'];
  assert.string(accountId, 'claim response accountId must be string');
  assert.string(sessionToken, 'claim response sessionToken must be string');
  assert.string(expiresAt, 'claim response expiresAt must be string');
  assert.string(
    sessionEntityId,
    'claim response sessionEntityId must be string'
  );
  return { accountId, sessionToken, expiresAt, sessionEntityId };
}

export async function postGoogleAuthClaim(args: {
  apiUrl: string;
  googleIdToken: string;
  deviceId: string;
}): Promise<GoogleClaimSuccess> {
  const { apiUrl, googleIdToken, deviceId } = args;
  const client = createApiClient(apiUrl);
  const response = await client.auth.claim.$post({
    json: { googleIdToken, deviceId },
  });

  const text = await response.text();
  let json: unknown;
  try {
    json = text.length > 0 ? (JSON.parse(text) as unknown) : null;
  } catch {
    throw new Error(
      `Claim response was not JSON (status ${String(response.status)})`
    );
  }

  if (!response.ok) {
    throw new Error(`Claim failed (${String(response.status)}): ${text}`);
  }

  assert.ok(json !== null, 'claim success body must not be empty');
  return parseClaimResponse(json);
}
