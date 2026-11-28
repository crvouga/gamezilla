import SwiftUI

/// The first screen shows the configured product mark and name.
struct RootView: View {
  var body: some View {
    VStack {
      Image(decorative: "brand-mark")
        .resizable()
        .scaledToFit()
        .frame(width: 64, height: 64)
      Text(ProductIdentity.displayName)
        .font(.system(.largeTitle, design: .rounded, weight: .bold))
        .foregroundStyle(Color("table-text"))
        .accessibilityAddTraits(.isHeader)
        .accessibilityIdentifier(AccessibilityID.title)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color("table-background").ignoresSafeArea())
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
