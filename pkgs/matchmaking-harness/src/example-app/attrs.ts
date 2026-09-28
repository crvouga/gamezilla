/**
 * The example app's attributes (rating, name, and the region and mode it
 * can partition by), the formula people accept each other with, and its
 * schema.
 */

import { createAttrNamespace } from '@pkgs/attribute';
import type {
  DistanceFormula,
  MatchmakingSchema,
} from '@pkgs/matchmaking/interface';

export const exampleNs = createAttrNamespace('example');

export const RatingAttr = exampleNs.number('rating', (v): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error('example/rating must be a finite number');
  }
  return v;
});

export const NameAttr = exampleNs.text('name', (v): string =>
  typeof v === 'string' ? v : ''
);

export const RegionAttr = exampleNs.textOrNull('region', (v): string | null =>
  typeof v === 'string' ? v : null
);

export const ModeAttr = exampleNs.textOrNull('mode', (v): string | null =>
  typeof v === 'string' ? v : null
);

/**
 * Accept anyone whose rating is within `points` of one's own, for as long as
 * one waits (the range never grows).
 */
export function ratingWithin(points: number): DistanceFormula {
  return {
    numeric: [{ tag: RatingAttr, weight: 1 }],
    radius: {
      baseRadius: points,
      radiusGrowthPerSecond: 0,
      maxRadius: points,
    },
  };
}

/** What the example app may partition its waits by. */
export type ExamplePartition = 'region' | 'mode';

const PARTITION_KEYS: Readonly<Record<ExamplePartition, string>> = {
  region: 'example/region',
  mode: 'example/mode',
};

/**
 * The example app's schema: one pool by default, or one pool per region or
 * per mode (a schema version change, for the drift contract).
 */
export function exampleAppSchema(
  opts: { readonly partitionBy?: ExamplePartition } = {}
): MatchmakingSchema {
  return opts.partitionBy === undefined
    ? {}
    : { partitionKeys: [PARTITION_KEYS[opts.partitionBy]] };
}
