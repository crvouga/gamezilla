import { expect, test } from 'bun:test';
import { lightCyclesCodec } from '@libs/light-cycles-shared-ts/light-cycles-codec';
import {
  LIGHT_CYCLES_SEATS,
  lightCyclesConfig,
} from '@libs/light-cycles-shared-ts/light-cycles-config';
import {
  initialLightCyclesState,
  type LightCyclesState,
} from '@libs/light-cycles-shared-ts/light-cycles-state';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  playBots,
  playLightCycles,
  randomSchedule,
} from './light-cycles-fixture';

const config = lightCyclesConfig({ targetScore: 2 });
const codec = lightCyclesCodec(config);

/** Every phase boundary plus a sample of the ticks in between. */
function sampled(states: readonly LightCyclesState[]): LightCyclesState[] {
  return states.filter(
    (state, index) =>
      index % 7 === 0 || state.phase !== states[index - 1]?.phase
  );
}

const reached = fc
  .record({
    seed: fc.integer(),
    count: fc.constantFrom(2 as const, 3 as const, 4 as const),
    density: fc.constantFrom(0.05, 0.5, 3),
  })
  .map(({ seed, count, density }) =>
    sampled(
      playLightCycles(
        config,
        LIGHT_CYCLES_SEATS[count],
        randomSchedule(seed, 1200, count, density)
      )
    )
  );

test('every state reached by random play round-trips through one canonical encoding', () => {
  assertProperty(
    'Light Cycles codec round trip',
    fc.property(reached, (states) => {
      for (const state of states) {
        const encoded = codec.encode(state);
        const decoded = codec.decode(encoded);
        expect(decoded).toEqual(state);
        expect(codec.encode(decoded!)).toBe(encoded);
      }
    })
  );
});

test('a mutated encoding is refused unless it is itself a canonical valid state', () => {
  assertProperty(
    'Light Cycles codec strictness',
    fc.property(
      reached,
      fc.nat(),
      fc.nat(),
      fc.constantFrom(...'0123456789;,/.-abcdLRUDxroc'.split('')),
      (states, pick, at, char) => {
        const encoded = codec.encode(states[pick % states.length]!);
        const position = at % encoded.length;
        const mutated =
          encoded.slice(0, position) + char + encoded.slice(position + 1);
        const decoded = codec.decode(mutated);
        if (decoded !== null) expect(codec.encode(decoded)).toBe(mutated);
      }
    )
  );
});

/** Replaces one `;`-separated field of a valid encoding. */
function withField(encoded: string, index: number, value: string): string {
  const fields = encoded.split(';');
  fields[index] = value;
  return fields.join(';');
}

test('decode refuses malformed and inconsistent encodings', () => {
  const initial = initialLightCyclesState(config, LIGHT_CYCLES_SEATS[2]);
  const valid = codec.encode(initial);
  expect(valid).toBe(
    'L1;40;28;2;15;2;c;0;1;0,0;-;-;9,6,R1/30,21,L1;;249.a620.b249.'
  );
  const refused = [
    '',
    'garbage',
    `${valid};`,
    `${valid}.`,
    withField(valid, 0, 'L2'),
    withField(valid, 1, '41'),
    withField(valid, 3, '3'),
    withField(valid, 5, '5'),
    withField(valid, 5, '3'),
    withField(valid, 6, 'q'),
    withField(valid, 7, '-1'),
    withField(valid, 7, '1.5'),
    withField(valid, 7, '01'),
    withField(valid, 7, '90'),
    withField(valid, 8, '0'),
    withField(valid, 8, '16'),
    withField(valid, 9, '3,0'),
    withField(valid, 9, '0'),
    withField(valid, 10, 'd'),
    withField(valid, 11, '0t'),
    withField(valid, 12, '9,6,R1'),
    withField(valid, 12, '9,6,R1/30,21,L1/30,6,D1'),
    withField(valid, 12, '40,6,R1/30,21,L1'),
    withField(valid, 12, '30,21,L1/30,21,L1'),
    withField(valid, 12, '9,6,X1/30,21,L1'),
    withField(valid, 12, '9,6,R1UU/30,21,L1'),
    withField(valid, 12, '9,6,R1ULD/30,21,L1'),
    withField(valid, 12, '9,6,R1L/30,21,L1'),
    withField(valid, 12, '9,6,R0U/30,21,L1'),
    withField(valid, 12, '9,6,R0/30,21,L1'),
    withField(valid, 13, '0,9,6,t'),
    withField(valid, 13, '0,9,6,r'),
    withField(valid, 14, '249.a620.b248.'),
    withField(valid, 14, '249.a620.b250.'),
    withField(valid, 14, '249.1a620.b249.'),
    withField(valid, 14, '249.a620.b248..'),
    withField(valid, 14, '249.a620.b249.e'),
  ];
  for (const encoded of refused) expect(codec.decode(encoded)).toBeNull();
  // A retired rider with its matching crash is a valid countdown state.
  expect(
    codec.decode(
      withField(withField(valid, 12, '9,6,R0/30,21,L1'), 13, '0,9,6,r')
    )
  ).not.toBeNull();
  expect(() => codec.encode({ ...initial, round: 0 })).toThrow();
  expect(lightCyclesCodec(lightCyclesConfig()).decode(valid)).toBeNull();
});

test('a crowded four-rider arena stays a few hundred characters', () => {
  const four = lightCyclesConfig({ targetScore: 9 });
  const fourCodec = lightCyclesCodec(four);
  const states = playBots(
    four,
    initialLightCyclesState(four, LIGHT_CYCLES_SEATS[4]),
    1500
  );
  const crowded = states.reduce((most, state) =>
    state.trails.replaceAll('.', '').length >
    most.trails.replaceAll('.', '').length
      ? state
      : most
  );
  const encoded = fourCodec.encode(crowded);
  expect(crowded.trails.replaceAll('.', '').length).toBeGreaterThan(250);
  expect(encoded.length).toBeLessThan(512);
  expect(fourCodec.decode(encoded)).toEqual(crowded);
});
