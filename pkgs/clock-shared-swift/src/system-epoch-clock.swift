// @io-wall-ok — the one wall clock adapter; constructed at process entry.
import Foundation

/// The wall clock. Constructed once, at a process entry point.
public struct SystemEpochClock: EpochClock {
  public init() {}

  public func nowMilliseconds() -> Int64 {
    Int64((Date().timeIntervalSince1970 * 1000).rounded(.down))
  }
}
