import { assert } from '@pkgs/assert';

const PGMM_MAGIC0 = 0x50; // P
const PGMM_MAGIC1 = 0x47; // G
const PGMM_MAGIC2 = 0x4d; // M
const PGMM_MAGIC3 = 0x4d; // M

const SNAPSHOT_KIND = 'postgres-mem';

function hasPgmmMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === PGMM_MAGIC0 &&
    bytes[1] === PGMM_MAGIC1 &&
    bytes[2] === PGMM_MAGIC2 &&
    bytes[3] === PGMM_MAGIC3
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/** JSON envelope around a PGMM blob (not `pg_dump`). */
export function encodePostgresMemSnapshotEnvelope(
  pgmm: Uint8Array
): Uint8Array {
  const payload = {
    v: 1 as const,
    kind: SNAPSHOT_KIND,
    pgmmB64: bytesToBase64(pgmm),
  };
  return new TextEncoder().encode(JSON.stringify(payload));
}

export function parsePostgresMemSnapshotEnvelope(
  bytes: Uint8Array
): Uint8Array {
  let payload: {
    v?: unknown;
    kind?: unknown;
    pgmmB64?: unknown;
  };
  try {
    payload = JSON.parse(new TextDecoder().decode(bytes)) as typeof payload;
  } catch {
    throw new Error(
      'SqlClientImplPostgresMem.importDatabaseBytes: expected JSON postgres-mem snapshot'
    );
  }
  if (
    payload.v !== 1 ||
    payload.kind !== SNAPSHOT_KIND ||
    typeof payload.pgmmB64 !== 'string'
  ) {
    throw new Error(
      'SqlClientImplPostgresMem.importDatabaseBytes: unsupported snapshot format'
    );
  }
  const pgmm = base64ToBytes(payload.pgmmB64);
  assert.ok(
    hasPgmmMagic(pgmm),
    'SqlClientImplPostgresMem.importDatabaseBytes: missing PGMM magic'
  );
  return pgmm;
}
