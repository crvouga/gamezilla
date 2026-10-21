// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "clock-shared-swift",
  platforms: [.iOS(.v18), .macOS(.v15)],
  products: [
    .library(name: "ClockShared", targets: ["ClockShared"])
  ],
  targets: [
    .target(name: "ClockShared", path: "src"),
    .testTarget(name: "ClockSharedTests", dependencies: ["ClockShared"], path: "tests"),
  ]
)
