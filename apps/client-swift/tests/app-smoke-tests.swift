import XCTest

/// Launches the built app in a simulator and finds its root view.
final class AppSmokeTests: XCTestCase {
  override func setUp() {
    continueAfterFailure = false
  }

  @MainActor
  func testLaunchShowsTheRootView() {
    let app = XCUIApplication()
    app.launch()

    XCTAssertEqual(app.state, .runningForeground)
    XCTAssertTrue(app.otherElements["root-view"].waitForExistence(timeout: 30))
    let title = app.staticTexts["root-title"]
    XCTAssertTrue(title.exists)
    XCTAssertEqual(title.label, ProductIdentity.displayName)
  }
}
