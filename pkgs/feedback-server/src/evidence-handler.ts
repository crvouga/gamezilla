import type { FeedbackAttachment } from '@pkgs/feedback-shared/types';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import { readBoundedBody } from './bounded-body';

export const MAX_EVIDENCE_BYTES = 12 * 1024 * 1024;
export const EVIDENCE_TYPE =
  /^(video\/(webm|mp4|quicktime)|image\/(png|jpeg|webp))$/;
export const EVIDENCE_ID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function createEvidenceHandler(options: {
  store: ObjectStore;
  allowedOrigin: string;
}) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin');
    const headers = {
      'Access-Control-Allow-Origin': options.allowedOrigin,
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Feedback-Name',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    if (origin !== null && origin !== options.allowedOrigin)
      return new Response('Origin refused', { status: 403, headers });
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    const id = url.pathname.split('/').at(-1) ?? '';
    if (!EVIDENCE_ID.test(id))
      return new Response('Invalid evidence id', { status: 400, headers });
    const key = `evidence/${id}`;
    if (request.method === 'GET') {
      const object = await options.store.get(key);
      if (!object)
        return new Response('Evidence unavailable', { status: 404, headers });
      return new Response(object.body, {
        headers: {
          ...headers,
          'Content-Type': object.contentType,
          'Content-Length': String(object.size),
        },
      });
    }
    if (request.method !== 'POST')
      return new Response('Use POST', { status: 405, headers });
    return uploadEvidence(request, {
      store: options.store,
      key,
      url: url.toString(),
      id,
      headers,
    });
  };
}

async function uploadEvidence(
  request: Request,
  options: {
    store: ObjectStore;
    key: string;
    id: string;
    url: string;
    headers: Record<string, string>;
  }
): Promise<Response> {
  const contentType = request.headers.get('Content-Type')?.split(';')[0] ?? '';
  if (!EVIDENCE_TYPE.test(contentType))
    return new Response('Choose a video or image', {
      status: 415,
      headers: options.headers,
    });
  if (await options.store.head(options.key))
    return new Response('Evidence id already used', {
      status: 409,
      headers: options.headers,
    });
  let bytes: Uint8Array;
  try {
    bytes = await readBoundedBody(request, MAX_EVIDENCE_BYTES);
  } catch {
    return new Response('Evidence is too large', {
      status: 413,
      headers: options.headers,
    });
  }
  if (!bytes.byteLength)
    return new Response('Empty evidence', {
      status: 400,
      headers: options.headers,
    });
  const name = decodeURIComponent(
    request.headers.get('X-Feedback-Name') ?? 'Evidence'
  )
    .replace(/[\r\n]/g, '')
    .slice(0, 120);
  const attachment: FeedbackAttachment = {
    id: options.id,
    name,
    contentType,
    size: bytes.byteLength,
    url: options.url,
  };
  await options.store.put(options.key, bytes, contentType);
  await options.store.put(
    `${options.key}.json`,
    new TextEncoder().encode(JSON.stringify(attachment)),
    'application/json'
  );
  return Response.json(attachment, { status: 201, headers: options.headers });
}
