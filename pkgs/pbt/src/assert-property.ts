import type { IAsyncProperty, IProperty, Parameters } from 'fast-check';
import fc from 'fast-check';

import { configurePbt } from './configure';

export type AssertPropertyParams = Parameters<unknown>;

/**
 * Named property assertion for bun:test.
 * Ensures {@link configurePbt} ran, then delegates to `fc.assert`.
 *
 * Sync properties return `void`; async properties return `Promise<void>`
 * (call sites must `await`).
 */
export function assertProperty<Ts>(
  _name: string,
  property: IProperty<Ts>,
  params?: AssertPropertyParams
): void;
export function assertProperty<Ts>(
  _name: string,
  property: IAsyncProperty<Ts>,
  params?: AssertPropertyParams
): Promise<void>;
export function assertProperty<Ts>(
  _name: string,
  property: IProperty<Ts> | IAsyncProperty<Ts>,
  params?: AssertPropertyParams
): void | Promise<void> {
  configurePbt();
  return fc.assert(property, params);
}
