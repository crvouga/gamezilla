import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Assert } from '@pkgs/assert-root-shared/assert';
import { assert } from '@pkgs/assert-root-shared/singleton';
import {
  asKeyword,
  assertKeyword,
  assertKeywordRecord,
  assertLocalName,
  assertNamespacedKeyword,
  assertNamespacePrefix,
  CLOJURE_KEBAB_SEGMENT,
  CLOJURE_NAMESPACED_KEYWORD_REGEX,
  isKebabSegment,
  isLocalName,
  isNamespacedKeyword,
  isNamespacePrefix,
  joinKeywordSegments,
  KEYWORD_MAX_LENGTH,
  KEYWORD_SEGMENT_MIN_LENGTH,
  namespacePrefixOf,
} from '@pkgs/keyword-shared/keyword';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import {
  arbKebabSegment,
  arbKeywordCandidate,
  arbNamespacedKeyword,
  arbNearMissString,
} from './keyword-arbitraries';
import {
  modelKeyword,
  modelNamespace,
  modelPrefixOf,
  modelSegment,
} from './keyword-model';

let disposeTestCrashHandler: () => void;
beforeAll(() => {
  disposeTestCrashHandler = Assert.registerCrashHandler({
    priority: 0,
    match: () => true,
    crash(message) {
      throw new Error(message);
    },
  });
});
afterAll(() => {
  disposeTestCrashHandler();
});

function throws(run: () => unknown): boolean {
  try {
    run();
    return false;
  } catch {
    return true;
  }
}

/** Segment-shaped candidates: keyword parts, near misses and valid segments. */
const arbSegmentCandidate = fc.oneof(
  arbKebabSegment(),
  arbNearMissString(),
  arbKeywordCandidate().map((key) => key.split('/')[0] ?? '')
);

describe('predicates agree with the reference model', () => {
  test('isNamespacedKeyword ≡ model', () => {
    assertProperty(
      'isNamespacedKeyword matches modelKeyword',
      fc.property(arbKeywordCandidate(), (key) => {
        expect(isNamespacedKeyword(key)).toBe(modelKeyword(key));
      })
    );
  });

  test('isKebabSegment ≡ isLocalName ≡ model segment', () => {
    assertProperty(
      'segment predicates match modelSegment',
      fc.property(arbSegmentCandidate, (seg) => {
        expect(isKebabSegment(seg)).toBe(modelSegment(seg));
        expect(isLocalName(seg)).toBe(modelSegment(seg));
      })
    );
  });

  test('isNamespacePrefix ≡ model namespace', () => {
    assertProperty(
      'isNamespacePrefix matches modelNamespace',
      fc.property(arbSegmentCandidate, (prefix) => {
        expect(isNamespacePrefix(prefix)).toBe(modelNamespace(prefix));
      })
    );
  });

  test('namespacePrefixOf ≡ model', () => {
    assertProperty(
      'namespacePrefixOf matches modelPrefixOf',
      fc.property(arbKeywordCandidate(), (key) => {
        expect(namespacePrefixOf(key)).toBe(modelPrefixOf(key));
      })
    );
  });

  test('non-strings are never keywords, segments or prefixes', () => {
    assertProperty(
      'non-string ⇒ every predicate false',
      fc.property(
        fc.anything().filter((v) => typeof v !== 'string'),
        (value) => {
          expect(isNamespacedKeyword(value)).toBe(false);
          expect(isKebabSegment(value)).toBe(false);
          expect(isLocalName(value)).toBe(false);
          expect(isNamespacePrefix(value)).toBe(false);
        }
      )
    );
  });
});

describe('shape regexes are looser or stricter in exactly the documented way', () => {
  test('a valid segment always matches CLOJURE_KEBAB_SEGMENT', () => {
    assertProperty(
      'isKebabSegment ⇒ CLOJURE_KEBAB_SEGMENT',
      fc.property(arbSegmentCandidate, (seg) => {
        if (isKebabSegment(seg)) {
          expect(CLOJURE_KEBAB_SEGMENT.test(seg)).toBe(true);
        }
      })
    );
  });

  test('a short key the shape regex accepts is a keyword', () => {
    assertProperty(
      'CLOJURE_NAMESPACED_KEYWORD_REGEX ⇒ isNamespacedKeyword (in bounds)',
      fc.property(arbNearMissString(), (key) => {
        if (CLOJURE_NAMESPACED_KEYWORD_REGEX.test(key)) {
          expect(isNamespacedKeyword(key)).toBe(true);
        }
      })
    );
  });
});

describe('assertions crash exactly when the predicate is false', () => {
  test('asKeyword / assertKeyword / assertNamespacedKeyword', () => {
    assertProperty(
      'keyword assertions ≡ !isNamespacedKeyword',
      fc.property(arbKeywordCandidate(), (key) => {
        const invalid = !isNamespacedKeyword(key);
        expect(throws(() => asKeyword(key))).toBe(invalid);
        expect(throws(() => assertKeyword(key))).toBe(invalid);
        expect(throws(() => assertNamespacedKeyword(assert, key))).toBe(
          invalid
        );
        if (!invalid) expect(asKeyword(key) as string).toBe(key);
      })
    );
  });

  test('assertNamespacePrefix / assertLocalName', () => {
    assertProperty(
      'segment assertions ≡ !predicate',
      fc.property(arbSegmentCandidate, (value) => {
        expect(throws(() => assertNamespacePrefix(assert, value))).toBe(
          !isNamespacePrefix(value)
        );
        expect(throws(() => assertLocalName(assert, value))).toBe(
          !isLocalName(value)
        );
      })
    );
  });

  test('assertKeywordRecord crashes iff some own key is not a keyword', () => {
    assertProperty(
      'assertKeywordRecord ≡ every key valid',
      fc.property(
        fc.dictionary(arbKeywordCandidate(), fc.nat(), { maxKeys: 5 }),
        (record) => {
          const allValid = Object.keys(record).every(isNamespacedKeyword);
          expect(throws(() => assertKeywordRecord(assert, record, 'r'))).toBe(
            !allValid
          );
        }
      )
    );
  });
});

describe('joinKeywordSegments', () => {
  test('joins valid segments with dots into a prefix that takes a local', () => {
    assertProperty(
      'joinKeywordSegments round-trip',
      fc.property(
        fc.array(arbKebabSegment(), { minLength: 1, maxLength: 4 }),
        arbKebabSegment(),
        (segments, local) => {
          const prefix = joinKeywordSegments(...segments);
          expect(prefix as string).toBe(segments.join('.'));
          expect(prefix.split('.')).toEqual(segments);
          const key = `${prefix}/${local}`;
          expect(isNamespacedKeyword(key)).toBe(true);
          expect(namespacePrefixOf(key)).toBe(prefix);
        }
      )
    );
  });

  test('crashes exactly when a segment or the joined prefix is invalid', () => {
    assertProperty(
      'joinKeywordSegments accepts ≡ model',
      fc.property(
        fc.array(arbSegmentCandidate, { maxLength: 4 }),
        (segments) => {
          const joined = segments.join('.');
          const accepted =
            segments.length > 0 &&
            segments.every(modelSegment) &&
            modelNamespace(joined) &&
            joined.length <=
              KEYWORD_MAX_LENGTH - 1 - KEYWORD_SEGMENT_MIN_LENGTH;
          expect(throws(() => joinKeywordSegments(...segments))).toBe(
            !accepted
          );
        }
      )
    );
  });
});

describe('valid keywords', () => {
  test('are accepted and split back into prefix and local', () => {
    assertProperty(
      'arbNamespacedKeyword ⇒ accepted',
      fc.property(arbNamespacedKeyword(), (key) => {
        expect(isNamespacedKeyword(key)).toBe(true);
        const prefix = namespacePrefixOf(key);
        expect(prefix).not.toBeNull();
        expect(isNamespacePrefix(prefix)).toBe(true);
        expect(isLocalName(key.slice((prefix ?? '').length + 1))).toBe(true);
      })
    );
  });
});
