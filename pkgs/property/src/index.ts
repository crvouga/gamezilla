/**
 * The one way to run a property in this repo: `assertProperty` pins the seed
 * and run count identically on every machine, so a property's verdict is a
 * function of the code and turbo can cache it (docs/TESTING.md § 3).
 *
 * A leaf over fast-check alone, so pure packages can property-test without
 * depending on the sim kernel — and without a cycle for the packages the sim
 * itself is built on.
 */
import fc from 'fast-check';

export {
  type AssertPropertyParams,
  assertProperty,
} from './assert-property';
export {
  arbFiniteNumber,
  arbJsonKey,
  arbJsonObject,
  arbJsonValue,
  type JsonValue,
} from './json';
export { fc };
