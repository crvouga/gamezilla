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
  deviceConnected,
  deviceRange,
  deviceView,
  type PersonDevice,
} from './devices';
export {
  availability,
  changeRange,
  connectDevice,
  LOBBY_ACTIONS,
  lastBegin,
  lastOffline,
  lastWait,
  repeatBegin,
  repeatChange,
  restriction,
  stopWaiting,
  timePasses,
  type WaitForMatchSpec,
  waitForMatch,
} from './lobby';
