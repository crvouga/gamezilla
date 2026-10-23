export type AwsSigV4Input = {
  readonly method: string;
  readonly host: string;
  readonly path: string;
  readonly query: string;
  readonly region: string;
  readonly service: string;
  readonly payload: Uint8Array;
  readonly nowMs: number;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly headers?: Readonly<Record<string, string>>;
};

export type AwsSigV4Result = {
  readonly authorization: string;
  readonly amzDate: string;
  readonly payloadHash: string;
  readonly headers: Readonly<Record<string, string>>;
};

export async function signAws4(input: AwsSigV4Input): Promise<AwsSigV4Result> {
  const stamp = amzTimestamp(input.nowMs);
  const payloadHash = await sha256Hex(input.payload);
  const headers = signedHeaders(input, stamp.amz, payloadHash);
  const names = Object.keys(headers).sort();
  const canonical = canonicalRequest(input, names, headers, payloadHash);
  const scope = `${stamp.day}/${input.region}/${input.service}/aws4_request`;
  const toSign = [
    'AWS4-HMAC-SHA256',
    stamp.amz,
    scope,
    await sha256Hex(utf8(canonical)),
  ].join('\n');
  const signature = await signingKeyHex({
    secret: input.secretAccessKey,
    day: stamp.day,
    region: input.region,
    service: input.service,
    toSign,
  });
  const authorization = `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  return { authorization, amzDate: stamp.amz, payloadHash, headers };
}

function signedHeaders(
  input: AwsSigV4Input,
  amzDate: string,
  payloadHash: string
): Record<string, string> {
  const headers: Record<string, string> = {
    host: input.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  for (const [name, value] of Object.entries(input.headers ?? {})) {
    headers[name.toLowerCase()] = value.trim();
  }
  return headers;
}

function canonicalRequest(
  input: AwsSigV4Input,
  names: readonly string[],
  headers: Readonly<Record<string, string>>,
  payloadHash: string
): string {
  const canonicalHeaders = names
    .map((name) => `${name}:${headers[name] ?? ''}\n`)
    .join('');
  return [
    input.method,
    canonicalPath(input),
    input.query,
    canonicalHeaders,
    names.join(';'),
    payloadHash,
  ].join('\n');
}

/** Non-S3 signing normalizes and escapes the already encoded request path. */
function canonicalPath(input: AwsSigV4Input): string {
  if (input.service === 's3') return input.path;
  const segments: string[] = [];
  for (const segment of input.path.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  const leading = input.path.startsWith('/') ? '/' : '';
  const trailing = segments.length > 0 && input.path.endsWith('/') ? '/' : '';
  return encodeURIComponent(`${leading}${segments.join('/')}${trailing}`)
    .replace(
      /[!'()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
    )
    .replaceAll('%2F', '/');
}

function amzTimestamp(nowMs: number): {
  readonly amz: string;
  readonly day: string;
} {
  const d = new Date(nowMs);
  const day = [
    pad(d.getUTCFullYear(), 4),
    pad(d.getUTCMonth() + 1, 2),
    pad(d.getUTCDate(), 2),
  ].join('');
  const time = [
    pad(d.getUTCHours(), 2),
    pad(d.getUTCMinutes(), 2),
    pad(d.getUTCSeconds(), 2),
  ].join('');
  return { amz: `${day}T${time}Z`, day };
}

function pad(value: number, width: number): string {
  return value.toString().padStart(width, '0');
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

async function sha256Hex(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes(value));
  return hex(new Uint8Array(digest));
}

/** A lone ArrayBuffer. TS 5.9 will not pass Uint8Array<ArrayBufferLike> to Web Crypto. */
function bytes(value: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(value.byteLength);
  new Uint8Array(copy).set(value);
  return copy;
}

async function signingKeyHex(input: {
  readonly secret: string;
  readonly day: string;
  readonly region: string;
  readonly service: string;
  readonly toSign: string;
}): Promise<string> {
  const dateKey = await hmac(utf8(`AWS4${input.secret}`), input.day);
  const regionKey = await hmac(dateKey, input.region);
  const serviceKey = await hmac(regionKey, input.service);
  const signingKey = await hmac(serviceKey, 'aws4_request');
  return hex(await hmac(signingKey, input.toSign));
}

async function hmac(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    bytes(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signed = await crypto.subtle.sign('HMAC', cryptoKey, bytes(utf8(data)));
  return new Uint8Array(signed);
}

function hex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}
