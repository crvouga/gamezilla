/**
 * Request plumbing shared by the provider's routes: JSON bodies read
 * defensively, and provider errors turned into the wire's error envelope.
 */
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { invalidRequest, ProviderError } from '../errors';

export type Body = Readonly<Record<string, unknown>>;

export async function readBody(c: Context): Promise<Body> {
  const text = await c.req.text();
  if (text.length === 0) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      return parsed as Body;
    }
  } catch {
    // fall through to the error below
  }
  throw invalidRequest('Request bodies must be a JSON object.');
}

export function stringField(body: Body, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw invalidRequest(`Missing required param: ${key}.`, key);
  }
  return value;
}

export function optionalString(body: Body, key: string): string | undefined {
  const value = body[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function recordField(body: Body, key: string): Body | undefined {
  const value = body[key];
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Body)
    : undefined;
}

export function stringRecord(value: Body | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value ?? {})) {
    if (typeof entry === 'string') out[key] = entry;
  }
  return out;
}

/** Runs a handler, answering a {@link ProviderError} with its envelope. */
export async function answer(
  c: Context,
  handler: () => Promise<unknown>
): Promise<Response> {
  try {
    return c.json(await handler(), 200);
  } catch (error) {
    if (error instanceof ProviderError) {
      return c.json(error.toBody(), error.status as ContentfulStatusCode);
    }
    throw error;
  }
}
