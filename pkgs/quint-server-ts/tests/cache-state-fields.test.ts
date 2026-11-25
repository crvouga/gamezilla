import { expect, test } from 'bun:test';
import { cacheValueParameters } from '@pkgs/quint-server-ts/cache-value-parameters';

const SOURCE = `module counter {
  var state: { count: int }
  action init = state' = { count: 0 }
  action step = state' = { count: state.count + (state.count - state.count) + 1 }
  val invAtMostOne = state.count <= 1
  pure def shadow(state: { count: int }): int = state.count + state.count
}`;

// regression: product-symbolic-model-compilation-timeout
test('operators share the same pre-state field without duplicating its projection', () => {
  const source = `module shared {
    var state: { count: int }
    action init = state' = { count: 0 }
    val twice = state.count + state.count
    action step = state' = { count: state.count + state.count + 1 }
    val invConsistent = twice == state.count * 2
  }`;
  const cached = cacheValueParameters(source);
  expect(cached.match(/state\.count/g)).toHaveLength(1);
  expect(cacheValueParameters(cached)).toBe(cached);
});

// regression: product-symbolic-model-compilation-timeout
test('repeated pre-state projections are shared without capturing shadowed parameters', () => {
  const cached = cacheValueParameters(SOURCE);
  expect(cached).toContain('val cached_state_');
  expect(cached.match(/state\.count/g)).toHaveLength(2);
  expect(cacheValueParameters(cached)).toBe(cached);
});
