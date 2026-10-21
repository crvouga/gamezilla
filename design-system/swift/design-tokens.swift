// Generated from design-system/design-tokens.json — do not edit.
// Paint with Color(.sRGB, red: green: blue: opacity:). Hue is degrees;
// saturation and lightness are percentages. A "px" quantity is one point.
public enum DesignTokens {
    public struct ColorValue: Equatable, Sendable {
        public let hue: Double
        public let saturation: Double
        public let lightness: Double
        public let alpha: Double
        public let red: Double
        public let green: Double
        public let blue: Double
    }

    public struct Quantity: Equatable, Sendable {
        public let value: Double
        public let unit: String
    }

    public struct Bezier: Equatable, Sendable {
        public let x1: Double
        public let y1: Double
        public let x2: Double
        public let y2: Double
    }

    public struct Shadow: Equatable, Sendable {
        public let color: ColorValue
        public let offsetX: Quantity
        public let offsetY: Quantity
        public let blur: Quantity
        public let spread: Quantity
    }

    public enum Color {
        public enum Light {
            public static let background = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let surface = ColorValue(hue: 0, saturation: 0, lightness: 98, alpha: 1, red: 0.98, green: 0.98, blue: 0.98)
            public static let surfaceMuted = ColorValue(hue: 0, saturation: 0, lightness: 94, alpha: 1, red: 0.94, green: 0.94, blue: 0.94)
            public static let surfaceElevated = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let surfaceOverlay = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let text = ColorValue(hue: 0, saturation: 0, lightness: 5, alpha: 1, red: 0.05, green: 0.05, blue: 0.05)
            public static let textSecondary = ColorValue(hue: 0, saturation: 0, lightness: 42, alpha: 1, red: 0.42, green: 0.42, blue: 0.42)
            public static let icon = ColorValue(hue: 0, saturation: 0, lightness: 42, alpha: 1, red: 0.42, green: 0.42, blue: 0.42)
            public static let tint = ColorValue(hue: 204, saturation: 100, lightness: 36, alpha: 1, red: 0, green: 0.432, blue: 0.72)
            public static let tintHover = ColorValue(hue: 204, saturation: 100, lightness: 30, alpha: 1, red: 0, green: 0.36, blue: 0.6)
            public static let tintActive = ColorValue(hue: 204, saturation: 100, lightness: 39, alpha: 1, red: 0, green: 0.468, blue: 0.78)
            public static let tintSubtle = ColorValue(hue: 204, saturation: 100, lightness: 48, alpha: 0.1, red: 0, green: 0.576, blue: 0.96)
            public static let onPrimary = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let onDestructive = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let onSuccess = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let onWarning = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let onInfo = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let onTintScrim = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 0.32, red: 0, green: 0, blue: 0)
            public static let interactiveHover = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 0.04, red: 0, green: 0, blue: 0)
            public static let interactivePress = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 0.08, red: 0, green: 0, blue: 0)
            public static let border = ColorValue(hue: 0, saturation: 0, lightness: 86, alpha: 1, red: 0.86, green: 0.86, blue: 0.86)
            public static let outline = ColorValue(hue: 0, saturation: 0, lightness: 56, alpha: 1, red: 0.56, green: 0.56, blue: 0.56)
            public static let focusRing = ColorValue(hue: 204, saturation: 100, lightness: 45, alpha: 1, red: 0, green: 0.54, blue: 0.9)
            public static let destructive = ColorValue(hue: 355, saturation: 78, lightness: 45, alpha: 1, red: 0.801, green: 0.099, blue: 0.1575)
            public static let destructiveActive = ColorValue(hue: 355, saturation: 78, lightness: 45, alpha: 1, red: 0.801, green: 0.099, blue: 0.1575)
            public static let destructiveSurface = ColorValue(hue: 355, saturation: 78, lightness: 50, alpha: 0.1, red: 0.89, green: 0.11, blue: 0.175)
            public static let success = ColorValue(hue: 145, saturation: 63, lightness: 28, alpha: 1, red: 0.1036, green: 0.4564, blue: 0.2506)
            public static let successSurface = ColorValue(hue: 145, saturation: 63, lightness: 42, alpha: 0.12, red: 0.1554, green: 0.6846, blue: 0.3759)
            public static let warning = ColorValue(hue: 30, saturation: 100, lightness: 30, alpha: 1, red: 0.6, green: 0.3, blue: 0)
            public static let warningSurface = ColorValue(hue: 40, saturation: 100, lightness: 50, alpha: 0.16, red: 1, green: 0.666667, blue: 0)
            public static let info = ColorValue(hue: 204, saturation: 100, lightness: 36, alpha: 1, red: 0, green: 0.432, blue: 0.72)
            public static let infoSurface = ColorValue(hue: 204, saturation: 100, lightness: 48, alpha: 0.1, red: 0, green: 0.576, blue: 0.96)
            public static let disabled = ColorValue(hue: 0, saturation: 0, lightness: 94, alpha: 1, red: 0.94, green: 0.94, blue: 0.94)
            public static let scrim = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 0.6, red: 0, green: 0, blue: 0)
            public static let shadowColor = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 0.12, red: 0, green: 0, blue: 0)
        }
        public enum Dark {
            public static let background = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 1, red: 0, green: 0, blue: 0)
            public static let surface = ColorValue(hue: 0, saturation: 0, lightness: 7, alpha: 1, red: 0.07, green: 0.07, blue: 0.07)
            public static let surfaceMuted = ColorValue(hue: 0, saturation: 0, lightness: 15, alpha: 1, red: 0.15, green: 0.15, blue: 0.15)
            public static let surfaceElevated = ColorValue(hue: 0, saturation: 0, lightness: 10, alpha: 1, red: 0.1, green: 0.1, blue: 0.1)
            public static let surfaceOverlay = ColorValue(hue: 0, saturation: 0, lightness: 15, alpha: 1, red: 0.15, green: 0.15, blue: 0.15)
            public static let text = ColorValue(hue: 0, saturation: 0, lightness: 96, alpha: 1, red: 0.96, green: 0.96, blue: 0.96)
            public static let textSecondary = ColorValue(hue: 0, saturation: 0, lightness: 66, alpha: 1, red: 0.66, green: 0.66, blue: 0.66)
            public static let icon = ColorValue(hue: 0, saturation: 0, lightness: 66, alpha: 1, red: 0.66, green: 0.66, blue: 0.66)
            public static let tint = ColorValue(hue: 204, saturation: 100, lightness: 62, alpha: 1, red: 0.24, green: 0.696, blue: 1)
            public static let tintHover = ColorValue(hue: 204, saturation: 100, lightness: 70, alpha: 1, red: 0.4, green: 0.76, blue: 1)
            public static let tintActive = ColorValue(hue: 204, saturation: 100, lightness: 39, alpha: 1, red: 0, green: 0.468, blue: 0.78)
            public static let tintSubtle = ColorValue(hue: 204, saturation: 100, lightness: 55, alpha: 0.16, red: 0.1, green: 0.64, blue: 1)
            public static let onPrimary = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let onDestructive = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let onSuccess = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 1, red: 0, green: 0, blue: 0)
            public static let onWarning = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 1, red: 0, green: 0, blue: 0)
            public static let onInfo = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 1, red: 0, green: 0, blue: 0)
            public static let onTintScrim = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 0.4, red: 0, green: 0, blue: 0)
            public static let interactiveHover = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 0.06, red: 1, green: 1, blue: 1)
            public static let interactivePress = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 0.12, red: 1, green: 1, blue: 1)
            public static let border = ColorValue(hue: 0, saturation: 0, lightness: 20, alpha: 1, red: 0.2, green: 0.2, blue: 0.2)
            public static let outline = ColorValue(hue: 0, saturation: 0, lightness: 45, alpha: 1, red: 0.45, green: 0.45, blue: 0.45)
            public static let focusRing = ColorValue(hue: 204, saturation: 100, lightness: 62, alpha: 1, red: 0.24, green: 0.696, blue: 1)
            public static let destructive = ColorValue(hue: 355, saturation: 90, lightness: 66, alpha: 1, red: 0.966, green: 0.354, blue: 0.405)
            public static let destructiveActive = ColorValue(hue: 355, saturation: 78, lightness: 45, alpha: 1, red: 0.801, green: 0.099, blue: 0.1575)
            public static let destructiveSurface = ColorValue(hue: 355, saturation: 90, lightness: 60, alpha: 0.16, red: 0.96, green: 0.24, blue: 0.3)
            public static let success = ColorValue(hue: 145, saturation: 60, lightness: 50, alpha: 1, red: 0.2, green: 0.8, blue: 0.45)
            public static let successSurface = ColorValue(hue: 145, saturation: 60, lightness: 50, alpha: 0.16, red: 0.2, green: 0.8, blue: 0.45)
            public static let warning = ColorValue(hue: 40, saturation: 100, lightness: 55, alpha: 1, red: 1, green: 0.7, blue: 0.1)
            public static let warningSurface = ColorValue(hue: 40, saturation: 100, lightness: 55, alpha: 0.16, red: 1, green: 0.7, blue: 0.1)
            public static let info = ColorValue(hue: 204, saturation: 100, lightness: 62, alpha: 1, red: 0.24, green: 0.696, blue: 1)
            public static let infoSurface = ColorValue(hue: 204, saturation: 100, lightness: 55, alpha: 0.14, red: 0.1, green: 0.64, blue: 1)
            public static let disabled = ColorValue(hue: 0, saturation: 0, lightness: 15, alpha: 1, red: 0.15, green: 0.15, blue: 0.15)
            public static let scrim = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 0.72, red: 0, green: 0, blue: 0)
            public static let shadowColor = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 0.6, red: 0, green: 0, blue: 0)
        }
    }
    public enum Tone {
        public enum Text {
            public static let `default` = ColorValue(hue: 0, saturation: 0, lightness: 5, alpha: 1, red: 0.05, green: 0.05, blue: 0.05)
            public static let secondary = ColorValue(hue: 0, saturation: 0, lightness: 42, alpha: 1, red: 0.42, green: 0.42, blue: 0.42)
            public static let tint = ColorValue(hue: 204, saturation: 100, lightness: 36, alpha: 1, red: 0, green: 0.432, blue: 0.72)
            public static let destructive = ColorValue(hue: 355, saturation: 78, lightness: 45, alpha: 1, red: 0.801, green: 0.099, blue: 0.1575)
            public static let success = ColorValue(hue: 145, saturation: 63, lightness: 28, alpha: 1, red: 0.1036, green: 0.4564, blue: 0.2506)
            public static let warning = ColorValue(hue: 30, saturation: 100, lightness: 30, alpha: 1, red: 0.6, green: 0.3, blue: 0)
            public static let info = ColorValue(hue: 204, saturation: 100, lightness: 36, alpha: 1, red: 0, green: 0.432, blue: 0.72)
            public static let onPrimary = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
        }
        public enum Surface {
            public static let background = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let surface = ColorValue(hue: 0, saturation: 0, lightness: 98, alpha: 1, red: 0.98, green: 0.98, blue: 0.98)
            public static let muted = ColorValue(hue: 0, saturation: 0, lightness: 94, alpha: 1, red: 0.94, green: 0.94, blue: 0.94)
            public static let elevated = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let overlay = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let tintSubtle = ColorValue(hue: 204, saturation: 100, lightness: 48, alpha: 0.1, red: 0, green: 0.576, blue: 0.96)
            public static let destructive = ColorValue(hue: 355, saturation: 78, lightness: 50, alpha: 0.1, red: 0.89, green: 0.11, blue: 0.175)
            public static let success = ColorValue(hue: 145, saturation: 63, lightness: 42, alpha: 0.12, red: 0.1554, green: 0.6846, blue: 0.3759)
            public static let warning = ColorValue(hue: 40, saturation: 100, lightness: 50, alpha: 0.16, red: 1, green: 0.666667, blue: 0)
            public static let info = ColorValue(hue: 204, saturation: 100, lightness: 48, alpha: 0.1, red: 0, green: 0.576, blue: 0.96)
        }
    }
    public enum Space {
        public enum Scale {
            public static let n0 = Quantity(value: 0, unit: "px")
            public static let n1 = Quantity(value: 4, unit: "px")
            public static let n2 = Quantity(value: 8, unit: "px")
            public static let n3 = Quantity(value: 12, unit: "px")
            public static let n4 = Quantity(value: 16, unit: "px")
            public static let n5 = Quantity(value: 20, unit: "px")
            public static let n6 = Quantity(value: 24, unit: "px")
            public static let n8 = Quantity(value: 32, unit: "px")
            public static let n10 = Quantity(value: 40, unit: "px")
            public static let n12 = Quantity(value: 48, unit: "px")
            public static let n16 = Quantity(value: 64, unit: "px")
        }
        public enum Role {
            public static let hairline = Quantity(value: 1, unit: "px")
            public static let inline = Quantity(value: 8, unit: "px")
            public static let stack = Quantity(value: 12, unit: "px")
            public static let section = Quantity(value: 24, unit: "px")
            public static let page = Quantity(value: 20, unit: "px")
        }
        public enum Size {
            public static let none = Quantity(value: 0, unit: "px")
            public static let xs = Quantity(value: 4, unit: "px")
            public static let sm = Quantity(value: 8, unit: "px")
            public static let md = Quantity(value: 12, unit: "px")
            public static let lg = Quantity(value: 16, unit: "px")
            public static let xl = Quantity(value: 24, unit: "px")
            public static let n2xl = Quantity(value: 32, unit: "px")
            public static let n3xl = Quantity(value: 48, unit: "px")
        }
    }
    public enum Font {
        public enum Family {
            public static let sans = ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"]
            public static let mono = ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "Liberation Mono", "monospace"]
        }
        public enum Size {
            public static let xs = Quantity(value: 12, unit: "px")
            public static let sm = Quantity(value: 14, unit: "px")
            public static let base = Quantity(value: 16, unit: "px")
            public static let lg = Quantity(value: 20, unit: "px")
            public static let xl = Quantity(value: 24, unit: "px")
            public static let n2xl = Quantity(value: 32, unit: "px")
        }
        public enum Leading {
            public static let xs = Quantity(value: 16, unit: "px")
            public static let sm = Quantity(value: 20, unit: "px")
            public static let base = Quantity(value: 24, unit: "px")
            public static let lg = Quantity(value: 28, unit: "px")
            public static let xl = Quantity(value: 32, unit: "px")
            public static let n2xl = Quantity(value: 40, unit: "px")
        }
        public enum LineHeight {
            public static let tight = 1.25
            public static let normal = 1.5
            public static let relaxed = 1.75
        }
        public enum Weight {
            public static let regular = 400
            public static let semibold = 600
            public static let bold = 700
        }
    }
    public enum Radius {
        public enum Scale {
            public static let none = Quantity(value: 0, unit: "px")
            public static let sm = Quantity(value: 4, unit: "px")
            public static let md = Quantity(value: 8, unit: "px")
            public static let lg = Quantity(value: 12, unit: "px")
            public static let full = Quantity(value: 9999, unit: "px")
        }
        public enum Role {
            public static let none = Quantity(value: 0, unit: "px")
            public static let sm = Quantity(value: 4, unit: "px")
            public static let control = Quantity(value: 8, unit: "px")
            public static let card = Quantity(value: 12, unit: "px")
            public static let sheet = Quantity(value: 12, unit: "px")
            public static let full = Quantity(value: 9999, unit: "px")
        }
    }
    public enum Motion {
        public enum Duration {
            public static let instant = Quantity(value: 0, unit: "ms")
            public static let fast = Quantity(value: 150, unit: "ms")
            public static let normal = Quantity(value: 200, unit: "ms")
            public static let slow = Quantity(value: 250, unit: "ms")
        }
        public enum Easing {
            public static let standard = Bezier(x1: 0.2, y1: 0, x2: 0, y2: 1)
        }
    }
    public enum Size {
        public enum Icon {
            public static let xs = Quantity(value: 12, unit: "px")
            public static let sm = Quantity(value: 16, unit: "px")
            public static let md = Quantity(value: 20, unit: "px")
            public static let lg = Quantity(value: 24, unit: "px")
            public static let xl = Quantity(value: 32, unit: "px")
            public static let n2xl = Quantity(value: 48, unit: "px")
        }
        public enum Control {
            public static let sm = Quantity(value: 32, unit: "px")
            public static let md = Quantity(value: 44, unit: "px")
            public static let lg = Quantity(value: 52, unit: "px")
        }
        public enum MaxWidth {
            public static let prose = Quantity(value: 640, unit: "px")
            public static let form = Quantity(value: 360, unit: "px")
            public static let content = Quantity(value: 768, unit: "px")
            public static let wide = Quantity(value: 1200, unit: "px")
        }
    }
    public enum Breakpoint {
        public static let sm = Quantity(value: 640, unit: "px")
        public static let md = Quantity(value: 768, unit: "px")
        public static let lg = Quantity(value: 1024, unit: "px")
        public static let xl = Quantity(value: 1280, unit: "px")
    }
    public enum Layer {
        public static let surface = 10000
        public static let overlay = 1000000
        public static let tooltip = 1000001
        public static let harnessBrowser = 2147483000
    }
    public enum Opacity {
        public static let muted = 0.55
        public static let disabled = 0.5
        public static let pressed = 0.7
    }
    public enum Shadow {
        public static let float = Shadow(color: ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 0.12, red: 0, green: 0, blue: 0), offsetX: Quantity(value: 0, unit: "px"), offsetY: Quantity(value: 4, unit: "px"), blur: Quantity(value: 16, unit: "px"), spread: Quantity(value: 0, unit: "px"))
    }
}
