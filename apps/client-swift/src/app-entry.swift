import ClockShared
import SwiftUI

/// The composition root: the one place the app constructs wall adapters.
@main
struct AppEntry: App {
  private let clock: any EpochClock = SystemEpochClock()

  var body: some Scene {
    WindowGroup {
      RootView()
        .environment(\.epochClock, clock)
    }
  }
}
