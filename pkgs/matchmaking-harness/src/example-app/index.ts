/**
 * The one example app every test, model and spec of `@pkgs/matchmaking`
 * drives: a lobby where named people wait for a rated match. A test that
 * needs a variation (another schema version) configures this app; it never
 * declares its own.
 */

export {
  type ExamplePartition,
  exampleAppSchema,
  exampleNs,
  ModeAttr,
  NameAttr,
  RatingAttr,
  RegionAttr,
  ratingWithin,
} from './attrs';
export {
  changeRange,
  LOBBY_ACTIONS,
  lastWait,
  stopWaiting,
  type WaitForMatchSpec,
  waitForMatch,
} from './lobby';
