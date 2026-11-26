import SwiftUI

/// The first screen: the product name on an otherwise empty surface.
struct RootView: View {
  var body: some View {
    VStack {
      Text(ProductIdentity.displayName)
        .font(.largeTitle.bold())
        .accessibilityAddTraits(.isHeader)
        .accessibilityIdentifier(AccessibilityID.title)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .accessibilityElement(children: .contain)
    .accessibilityIdentifier(AccessibilityID.root)
  }
}

/// Identifiers the smoke tests find the root view by.
enum AccessibilityID {
  static let root = "root-view"
  static let title = "root-title"
}

#Preview {
  RootView()
}
