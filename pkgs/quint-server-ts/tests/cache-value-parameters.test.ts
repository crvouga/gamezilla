import { expect, test } from 'bun:test';
import { cacheValueParameters } from '@pkgs/quint-server-ts/cache-value-parameters';

// regression: quint-untyped-record-parameters-expanded
test('record field reads cache inferred values while operator parameters remain callable', () => {
  const source = `module inferred {
    pure def advance(view) = view.count + (view.count - view.count) + 1
    pure def applyTwice(transform, value) = transform(transform(value))
    pure val example = applyTwice(x => advance({ count: x }), 1)
  }`;
  const cached = cacheValueParameters(source);
  expect(cached).toContain('pure val view = cached_input_');
  // regression: quint-repeated-record-fields-inference
  expect(cached.match(/view\.count/g)).toHaveLength(1);
  expect(cached).toContain('applyTwice(transform, value)');
  expect(cacheValueParameters(cached)).toBe(cached);
});

// regression: quint-cached-sum-type-syntax
test('cached value parameters preserve sum constructors and local shadowing', () => {
  const source = `module choice {
    type Choice = Waiting | Selected(str)
    type View = { choice: Choice, count: int }
    pure def show(view: View): View = {
      val changed = { ...view, count: view.count + 1 }
      if (changed.count > 3) {
        val view = { choice: Waiting, count: 0 }
        view
      } else changed
    }
    pure val example = show({ choice: Selected("rival"), count: 1 })
  }`;
  const cached = cacheValueParameters(source);
  expect(cached).toContain('pure val view: View = cached_input_');
  expect(cacheValueParameters(cached)).toBe(cached);
});
