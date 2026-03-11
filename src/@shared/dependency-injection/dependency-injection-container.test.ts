import { describe, expect, test } from 'bun:test';
import {
  DependencyInjectionContainer,
  type InjectionToken,
} from './dependency-injection-container';

const TokenA = Symbol('A') as InjectionToken<string>;
const TokenB = Symbol('B') as InjectionToken<number>;
const TokenC = Symbol('C') as InjectionToken<{ a: string; b: number }>;

describe('DependencyInjectionContainer', () => {
  test('registerValue and get', () => {
    const c = new DependencyInjectionContainer();
    c.registerValue(TokenA, 'hello');
    const val = c.get(TokenA);
    expect(val).toBe('hello');
  });

  test('register factory with singleton', () => {
    const c = new DependencyInjectionContainer();
    let count = 0;
    c.register(
      TokenA,
      () => {
        count++;
        return 'created';
      },
      { singleton: true }
    );
    const val1 = c.get(TokenA);
    const val2 = c.get(TokenA);
    expect(val1).toBe('created');
    expect(val2).toBe('created');
    expect(count).toBe(1);
  });

  test('register factory with transient', () => {
    const c = new DependencyInjectionContainer();
    let count = 0;
    c.register(
      TokenA,
      () => {
        count++;
        return 'created';
      },
      { singleton: false }
    );
    const val1 = c.get(TokenA);
    const val2 = c.get(TokenA);
    expect(val1).toBe('created');
    expect(val2).toBe('created');
    expect(count).toBe(2);
  });

  test('factory can resolve other tokens', () => {
    const c = new DependencyInjectionContainer();
    c.registerValue(TokenA, 'a');
    c.registerValue(TokenB, 42);
    c.register(
      TokenC,
      () => ({
        a: c.get(TokenA),
        b: c.get(TokenB),
      }),
      { singleton: true }
    );
    const result = c.get<{ a: string; b: number }>(TokenC);
    expect(result.a).toBe('a');
    expect(result.b).toBe(42);
  });

  test('has returns true for registered token', () => {
    const c = new DependencyInjectionContainer();
    c.registerValue(TokenA, 'x');
    expect(c.has(TokenA)).toBe(true);
    expect(c.has(TokenB)).toBe(false);
  });

  test('get throws for unregistered token', () => {
    const c = new DependencyInjectionContainer();
    expect(() => c.get(TokenA)).toThrow('No registration found');
  });

  test('createChild inherits parent registrations', () => {
    const parent = new DependencyInjectionContainer();
    parent.registerValue(TokenA, 'parent-a');
    const child = parent.createChild();
    const val = child.get(TokenA);
    expect(val).toBe('parent-a');
  });

  test('createChild override shadows parent', () => {
    const parent = new DependencyInjectionContainer();
    parent.registerValue(TokenA, 'parent-a');
    const child = parent.createChild();
    child.registerValue(TokenA, 'child-a');
    const childVal = child.get(TokenA);
    const parentVal = parent.get(TokenA);
    expect(childVal).toBe('child-a');
    expect(parentVal).toBe('parent-a');
  });

  test('circular dependency throws', () => {
    const c = new DependencyInjectionContainer();
    const TokenX = Symbol('X') as InjectionToken<unknown>;
    const TokenY = Symbol('Y') as InjectionToken<unknown>;
    c.register(TokenX, () => c.get(TokenY), { singleton: true });
    c.register(TokenY, () => c.get(TokenX), { singleton: true });
    expect(() => c.get(TokenX)).toThrow('Circular dependency');
  });

  test('string tokens work', () => {
    const c = new DependencyInjectionContainer();
    const token = 'myToken' as InjectionToken<string>;
    c.registerValue(token, 'str');
    const val = c.get(token);
    expect(val).toBe('str');
  });
});
