/**
 * Wire-protocol types for the matchmaking HTTP boundary.
 *
 * Imported via `@gamezilla/matchmaking/wire` by HTTP-protocol consumers
 * that need to construct or validate `FormulaWire` JSON outside the
 * server (e.g. a non-TS client, a code generator, a doc emitter). The
 * runtime `Matchmaking` class consumes `DistanceFormula` with rich
 * `AttributeTag` objects; only the wire boundary uses these plain
 * string-path shapes.
 */

export type {
  CategoricalTermWire,
  FormulaWire,
  NumericTermWire,
  PartitionTermWire,
} from './formula-wire';
