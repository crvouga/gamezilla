import Synchronization

/// A clock that moves only when told to. Time never runs backwards.
public final class SettableEpochClock: EpochClock {
  /// Why a requested move was refused.
  public enum MoveError: Error, Equatable {
    case negativeDelta(Int64)
    case backwards(from: Int64, to: Int64)
  }

  private let current: Mutex<Int64>

  public init(startMilliseconds: Int64 = 0) {
    current = Mutex(startMilliseconds)
  }

  public func nowMilliseconds() -> Int64 {
    current.withLock { $0 }
  }

  /// Move forward by `milliseconds`.
  public func advance(by milliseconds: Int64) throws(MoveError) {
    guard milliseconds >= 0 else { throw .negativeDelta(milliseconds) }
    current.withLock { $0 += milliseconds }
  }

  /// Jump to `milliseconds`, which must not be earlier than now.
  public func set(to milliseconds: Int64) throws(MoveError) {
    try current.withLock { (now: inout Int64) throws(MoveError) in
      guard milliseconds >= now else {
        throw .backwards(from: now, to: milliseconds)
      }
      now = milliseconds
    }
  }
}
