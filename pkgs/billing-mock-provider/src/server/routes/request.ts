/**
 * Request plumbing shared by the provider's routes: bodies read defensively
 * — JSON, or Stripe's `application/x-www-form-urlencoded` bracket encoding
 * (`line_items[0][price]=…`, `expand[]=…`) — and provider errors turned into
 * the wire's error envelope.
 */
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { invalidRequest, ProviderError } from '../errors';

export type Body = Readonly<Record<string, unknown>>;

type Mutable = Record<string, unknown>;

/** `a[b][0]` → `['a', 'b', '0']`; `a[]` → `['a', '']`. */
function pathOf(key: string): readonly string[] {
  const head = key.split('[', 1)[0] ?? key;
  const rest = [...key.slice(head.length).matchAll(/\[([^\]]*)\]/g)].map(
    (match) => match[1] ?? ''
  );
  return [head, ...rest];
}

function isIndex(segment: string): boolean {
  return segment === '' || /^\d+$/.test(segment);
}

function assign(target: Mutable, path: readonly string[], value: string) {
  let node: Mutable = target;
  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index] ?? '';
    const child = node[segment];
    const next: Mutable =
      child !== null && typeof child === 'object'
        ? (child as Mutable)
        : isIndex(path[index + 1] ?? '')
          ? ([] as unknown as Mutable)
          : {};
    node[segment] = next;
    node = next;
  }
  const last = path.at(-1) ?? '';
  if (Array.isArray(node) && last === '') (node as unknown[]).push(value);
  else node[last] = value;
}

const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);

/** Stripe's form encoding, nested back into objects and arrays. */
export function parseForm(params: URLSearchParams): Body {
  const out: Mutable = {};
  for (const [key, value] of params) {
    const path = pathOf(key);
    if (path.some((segment) => UNSAFE.has(segment))) continue;
    assign(out, path, value);
  }
  return out;
}

export async function readBody(c: Context): Promise<Body> {
  const text = await c.req.text();
  if (text.length === 0) return {};
  const type = c.req.header('content-type') ?? '';
  if (type.startsWith('application/x-www-form-urlencoded')) {
    return parseForm(new URLSearchParams(text));
  }
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
  throw invalidRequest(
    'Request bodies must be a JSON object or form-encoded parameters.'
  );
}

/** The query string, nested the same way (`expand[]`, `lookup_keys[0]`). */
export function readQuery(c: Context): Body {
  return parseForm(new URL(c.req.url).searchParams);
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

/** A boolean, sent as JSON `true` or form `"true"`. */
export function optionalBoolean(body: Body, key: string): boolean | undefined {
  const value = body[key];
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === undefined) return undefined;
  throw invalidRequest(`Invalid boolean: ${String(value)}`, key);
}

/** An integer, sent as a JSON number or a form string. */
export function optionalInteger(body: Body, key: string): number | undefined {
  const value = body[key];
  if (value === undefined || value === '') return undefined;
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isInteger(parsed)) {
    throw invalidRequest(`Invalid integer: ${String(value)}`, key);
  }
  return parsed;
}

export function recordField(body: Body, key: string): Body | undefined {
  const value = body[key];
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Body)
    : undefined;
}

/** A list, sent as a JSON array, a form array (`a[]`/`a[0]`) or `a=x,y`. */
export function listField(body: Body, key: string): readonly unknown[] {
  const value = body[key];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').filter(Boolean);
  const record = recordField(body, key);
  return record === undefined ? [] : Object.values(record);
}

export function stringList(body: Body, key: string): readonly string[] {
  return listField(body, key).filter(
    (entry): entry is string => typeof entry === 'string' && entry.length > 0
  );
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
