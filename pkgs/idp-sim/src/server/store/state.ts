/** Singleton rows: the fault switches and the RS256 signing key. */

import { raw, sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';
import type { JWK } from 'jose';
import { IDP_DEFAULT_FAULTS, type IdpFaults } from '../../shared/types';
import type { IdpSigningKeyRecord } from '../idp-keys';
import { IDP_SIM_FAULTS_ID, IDP_SIM_SIGNING_KEY_ID } from '../schema/tables';
import { encodeJson, rowText } from './codec';

type Row = Record<string, unknown>;

/** Merge a stored patch over the defaults so new switches always have a value. */
export function normalizeFaults(raw: unknown): IdpFaults {
  if (raw === null || typeof raw !== 'object') return IDP_DEFAULT_FAULTS;
  const patch = raw as Partial<IdpFaults>;
  const d = IDP_DEFAULT_FAULTS;
  return {
    tokenEndpoint: patch.tokenEndpoint ?? d.tokenEndpoint,
    userinfoEndpoint: patch.userinfoEndpoint ?? d.userinfoEndpoint,
    denyConsent: patch.denyConsent ?? d.denyConsent,
    withholdRefreshToken: patch.withholdRefreshToken ?? d.withholdRefreshToken,
    stringBooleanClaims: patch.stringBooleanClaims ?? d.stringBooleanClaims,
    idTokenClockSkewSeconds:
      patch.idTokenClockSkewSeconds ?? d.idTokenClockSkewSeconds,
    idTokenSignedWithUnknownKey:
      patch.idTokenSignedWithUnknownKey ?? d.idTokenSignedWithUnknownKey,
  };
}

export async function readFaults(db: SqlTx): Promise<IdpFaults> {
  const rows = await db.query(
    sql<Row>`SELECT payload FROM idp_sim_faults WHERE id = ${IDP_SIM_FAULTS_ID}`
  );
  const payload = rows[0]?.['payload'];
  if (typeof payload !== 'string') return IDP_DEFAULT_FAULTS;
  return normalizeFaults(JSON.parse(payload));
}

export async function writeFaults(db: SqlTx, faults: IdpFaults): Promise<void> {
  const payload = encodeJson(faults);
  const updated = await db.run(
    sql`UPDATE idp_sim_faults SET payload = ${payload} WHERE id = ${IDP_SIM_FAULTS_ID}`
  );
  if (updated.changes === 0) {
    await db.run(
      sql`INSERT INTO idp_sim_faults (id, payload) VALUES (${IDP_SIM_FAULTS_ID}, ${payload})`
    );
  }
}

export async function readSigningKeyRecord(
  db: SqlTx
): Promise<IdpSigningKeyRecord | null> {
  const rows = await db.query(
    sql<Row>`SELECT ${raw('kid, alg, private_jwk, public_jwk')} FROM idp_sim_signing_keys WHERE id = ${IDP_SIM_SIGNING_KEY_ID}`
  );
  const row = rows[0];
  if (row === undefined) return null;
  const alg = rowText(row, 'alg');
  if (alg !== 'RS256') {
    throw new Error(`idp_sim: unsupported stored signing alg '${alg}'`);
  }
  return {
    kid: rowText(row, 'kid'),
    alg,
    privateJwk: JSON.parse(rowText(row, 'private_jwk')) as JWK,
    publicJwk: JSON.parse(rowText(row, 'public_jwk')) as JWK,
  };
}

/** Insert the signing key, or replace it (a key rotation). */
export async function writeSigningKeyRecord(
  db: SqlTx,
  record: IdpSigningKeyRecord
): Promise<void> {
  const privateJwk = encodeJson(record.privateJwk);
  const publicJwk = encodeJson(record.publicJwk);
  const updated = await db.run(
    sql`UPDATE idp_sim_signing_keys SET kid = ${record.kid}, alg = ${record.alg}, private_jwk = ${privateJwk}, public_jwk = ${publicJwk}
      WHERE id = ${IDP_SIM_SIGNING_KEY_ID}`
  );
  if (updated.changes === 0) {
    await db.run(
      sql`INSERT INTO idp_sim_signing_keys (id, kid, alg, private_jwk, public_jwk)
        VALUES (${IDP_SIM_SIGNING_KEY_ID}, ${record.kid}, ${record.alg}, ${privateJwk}, ${publicJwk})`
    );
  }
}
