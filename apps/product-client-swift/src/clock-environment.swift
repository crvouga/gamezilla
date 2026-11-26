import ClockShared
import SwiftUI

extension EnvironmentValues {
  /// The clock the composition root installs. A view that reads it before
  /// one is installed fails loudly instead of falling back to the wall.
  @Entry var epochClock: any EpochClock = UninstalledEpochClock()
}

private struct UninstalledEpochClock: EpochClock {
  func nowMilliseconds() -> Int64 {
    preconditionFailure(
      "No EpochClock is installed; the composition root sets .environment(\\.epochClock, …)")
  }
}
