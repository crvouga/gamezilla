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
    .background {
      LinearGradient(
        stops: [
          .init(color: Color("table-surface-elevated"), location: 0),
          .init(color: Color("table-surface"), location: 0.3),
          .init(color: Color("table-background"), location: 0.76)
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      .ignoresSafeArea()
    }
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
