import fc from 'fast-check';

import { assertProperty } from './assert-property';
import { configurePbt } from './configure';

configurePbt();

export type { AssertDstPropertyParams } from './assert-dst-property';
export type { AssertPropertyParams } from './assert-property';
export { assertDstProperty } from './assert-dst-property';
export { assertProperty, configurePbt, fc };
export default fc;

export { arbDistinctUserPair, arbUserId } from './arbitraries/id';
export {
  arbFiniteNumber,
  arbJsonKey,
  arbJsonObject,
  arbJsonValue,
  type JsonValue,
} from './arbitraries/json-value';
export {
  arbKebabSegment,
  arbNamespacedKeyword,
} from './arbitraries/keyword';
export {
  arbChunkSplits,
  arbNdjsonEndFrame,
  arbNdjsonErrorFrame,
  arbNdjsonFrame,
  arbNdjsonResultFrame,
  type NdjsonFrameLike,
} from './arbitraries/ndjson-frame';
