import fc from 'fast-check';

/** Single kebab segment matching wire keyword rules (length 2–16 for speed). */
export const arbKebabSegment = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyz'.split('')
      ) as fc.Arbitrary<string>,
      fc.array(
        fc.constantFrom(
          ...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')
        ) as fc.Arbitrary<string>,
        { minLength: 1, maxLength: 10 }
      ),
      fc.option(
        fc
          .tuple(
            fc.constantFrom(
              ...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')
            ) as fc.Arbitrary<string>,
            fc.array(
              fc.constantFrom(
                ...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')
              ) as fc.Arbitrary<string>,
              { minLength: 1, maxLength: 4 }
            )
          )
          .map(([h, t]) => `-${h}${t.join('')}`),
        { nil: undefined }
      )
    )
    .map(([head, mid, extra]) => `${head}${mid.join('')}${extra ?? ''}`);

/** Construct a valid `ns.sub/local` keyword (no filter starvation). */
export const arbNamespacedKeyword = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.array(arbKebabSegment(), { minLength: 1, maxLength: 3 }),
      arbKebabSegment()
    )
    .map(([ns, local]) => `${ns.join('.')}/${local}`);
