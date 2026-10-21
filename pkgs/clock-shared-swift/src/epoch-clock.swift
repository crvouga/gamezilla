/// Milliseconds since the Unix epoch, read from an injected source.
///
/// Product code never reads the wall clock directly: a composition root
/// hands every consumer one `EpochClock`, so tests drive time instead of
/// waiting for it.
public protocol EpochClock: Sendable {
  /// The current time in milliseconds since 1970-01-01T00:00:00Z.
  func nowMilliseconds() -> Int64
}
