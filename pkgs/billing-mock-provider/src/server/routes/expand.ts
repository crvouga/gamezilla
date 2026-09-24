/**
 * Stripe's `expand[]`: a field that holds an id comes back as the object it
 * names. Works on an object's own fields and, with a `data.` prefix, on each
 * item of a list. Asking to expand anything else is a 400, as on Stripe.
 */
import type { MockList } from '@pkgs/billing-mock/wire';

import type { Engine } from '../engine/context';
import { requireCustomer } from '../engine/customers';
import { invalidRequest } from '../errors';
import type { StoredObject } from '../store';
import { type Body, stringList } from './request';

/** `expand[]` from the query string (GET) or the body (POST). */
export function expandOf(params: Body): readonly string[] {
  return stringList(params, 'expand');
}

/** Which object type each expandable field names. */
const EXPANDABLE: Readonly<Record<string, string>> = {
  customer: 'customer',
  latest_invoice: 'invoice',
  default_payment_method: 'payment_method',
  subscription: 'subscription',
};

async function load(
  engine: Engine,
  type: string,
  id: string
): Promise<unknown> {
  if (type === 'customer') return await requireCustomer(engine, id);
  return (await engine.db.get<StoredObject>(id, type)) ?? id;
}

async function expandOne<T extends StoredObject>(
  engine: Engine,
  object: T,
  fields: readonly string[]
): Promise<T> {
  const out: Record<string, unknown> = { ...object };
  for (const field of fields) {
    const type = EXPANDABLE[field];
    if (type === undefined || !(field in out)) {
      throw invalidRequest(
        `This property cannot be expanded (${field}).`,
        'expand'
      );
    }
    const value = out[field];
    if (typeof value === 'string') out[field] = await load(engine, type, value);
  }
  return out as T;
}

export async function expandObject<T extends StoredObject>(
  engine: Engine,
  object: T,
  paths: readonly string[]
): Promise<T> {
  if (paths.length === 0) return object;
  return await expandOne(engine, object, paths);
}

export async function expandList<T extends StoredObject>(
  engine: Engine,
  list: MockList<T>,
  paths: readonly string[]
): Promise<MockList<T>> {
  const fields = paths.map((path) => {
    if (!path.startsWith('data.')) {
      throw invalidRequest(
        `This property cannot be expanded (${path}).`,
        'expand'
      );
    }
    return path.slice('data.'.length);
  });
  if (fields.length === 0) return list;
  const data: T[] = [];
  for (const item of list.data) {
    data.push(await expandOne(engine, item, fields));
  }
  return { ...list, data };
}
