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

    public enum Color {
        public enum Light {
            public static let background = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let surface = ColorValue(hue: 180, saturation: 14, lightness: 97, alpha: 1, red: 0.9658, green: 0.9742, blue: 0.9742)
            public static let surfaceSunken = ColorValue(hue: 195, saturation: 15, lightness: 94, alpha: 1, red: 0.931, green: 0.9445, blue: 0.949)
            public static let surfaceMuted = ColorValue(hue: 195, saturation: 15, lightness: 94, alpha: 1, red: 0.931, green: 0.9445, blue: 0.949)
            public static let surfaceElevated = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let surfaceOverlay = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let text = ColorValue(hue: 210, saturation: 25, lightness: 7, alpha: 1, red: 0.0525, green: 0.07, blue: 0.0875)
            public static let textSecondary = ColorValue(hue: 206, saturation: 13, lightness: 37, alpha: 1, red: 0.3219, green: 0.376413, blue: 0.4181)
            public static let icon = ColorValue(hue: 206, saturation: 13, lightness: 37, alpha: 1, red: 0.3219, green: 0.376413, blue: 0.4181)
            public static let tint = ColorValue(hue: 204, saturation: 88, lightness: 37, alpha: 1, red: 0.0444, green: 0.43512, blue: 0.6956)
            public static let tintHover = ColorValue(hue: 204, saturation: 88, lightness: 31, alpha: 1, red: 0.0372, green: 0.36456, blue: 0.5828)
            public static let tintActive = ColorValue(hue: 204, saturation: 88, lightness: 39, alpha: 1, red: 0.0468, green: 0.45864, blue: 0.7332)
            public static let tintSubtle = ColorValue(hue: 204, saturation: 88, lightness: 53, alpha: 0.1, red: 0.1164, green: 0.61272, blue: 0.9436)
            public static let tintMuted = ColorValue(hue: 204, saturation: 88, lightness: 53, alpha: 0.24, red: 0.1164, green: 0.61272, blue: 0.9436)
            public static let tintHighlight = ColorValue(hue: 204, saturation: 88, lightness: 53, alpha: 0.14, red: 0.1164, green: 0.61272, blue: 0.9436)
            public static let onPrimary = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let onDestructive = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let onSuccess = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let onWarning = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let onInfo = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let onTintScrim = ColorValue(hue: 210, saturation: 25, lightness: 7, alpha: 0.32, red: 0.0525, green: 0.07, blue: 0.0875)
            public static let interactiveHover = ColorValue(hue: 210, saturation: 25, lightness: 7, alpha: 0.04, red: 0.0525, green: 0.07, blue: 0.0875)
            public static let interactivePress = ColorValue(hue: 210, saturation: 25, lightness: 7, alpha: 0.08, red: 0.0525, green: 0.07, blue: 0.0875)
            public static let border = ColorValue(hue: 200, saturation: 17, lightness: 91, alpha: 1, red: 0.8947, green: 0.9151, blue: 0.9253)
            public static let outline = ColorValue(hue: 204, saturation: 16, lightness: 82, alpha: 1, red: 0.7912, green: 0.82576, blue: 0.8488)
            public static let focusRing = ColorValue(hue: 204, saturation: 88, lightness: 53, alpha: 0.6, red: 0.1164, green: 0.61272, blue: 0.9436)
            public static let tabIconDefault = ColorValue(hue: 206, saturation: 13, lightness: 37, alpha: 1, red: 0.3219, green: 0.376413, blue: 0.4181)
            public static let tabIconSelected = ColorValue(hue: 210, saturation: 25, lightness: 7, alpha: 1, red: 0.0525, green: 0.07, blue: 0.0875)
            public static let destructive = ColorValue(hue: 356, saturation: 78, lightness: 44, alpha: 1, red: 0.7832, green: 0.0968, blue: 0.14256)
            public static let destructiveActive = ColorValue(hue: 356, saturation: 78, lightness: 44, alpha: 1, red: 0.7832, green: 0.0968, blue: 0.14256)
            public static let destructiveSurface = ColorValue(hue: 356, saturation: 91, lightness: 54, alpha: 0.1, red: 0.9586, green: 0.1214, blue: 0.177213)
            public static let success = ColorValue(hue: 160, saturation: 100, lightness: 23, alpha: 1, red: 0, green: 0.46, blue: 0.306667)
            public static let successSurface = ColorValue(hue: 160, saturation: 100, lightness: 36, alpha: 0.12, red: 0, green: 0.72, blue: 0.48)
            public static let warning = ColorValue(hue: 30, saturation: 100, lightness: 30, alpha: 1, red: 0.6, green: 0.3, blue: 0)
            public static let warningSurface = ColorValue(hue: 50, saturation: 100, lightness: 50, alpha: 0.18, red: 1, green: 0.833333, blue: 0)
            public static let info = ColorValue(hue: 204, saturation: 88, lightness: 37, alpha: 1, red: 0.0444, green: 0.43512, blue: 0.6956)
            public static let infoSurface = ColorValue(hue: 204, saturation: 88, lightness: 53, alpha: 0.1, red: 0.1164, green: 0.61272, blue: 0.9436)
            public static let disabled = ColorValue(hue: 195, saturation: 15, lightness: 92, alpha: 1, red: 0.908, green: 0.926, blue: 0.932)
            public static let scrim = ColorValue(hue: 210, saturation: 25, lightness: 7, alpha: 0.4, red: 0.0525, green: 0.07, blue: 0.0875)
            public static let shadowColor = ColorValue(hue: 210, saturation: 25, lightness: 7, alpha: 0.12, red: 0.0525, green: 0.07, blue: 0.0875)
        }
        public enum Dark {
            public static let background = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 1, red: 0, green: 0, blue: 0)
            public static let surface = ColorValue(hue: 220, saturation: 12, lightness: 10, alpha: 1, red: 0.088, green: 0.096, blue: 0.112)
            public static let surfaceSunken = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 1, red: 0, green: 0, blue: 0)
            public static let surfaceMuted = ColorValue(hue: 210, saturation: 10, lightness: 14, alpha: 1, red: 0.126, green: 0.14, blue: 0.154)
            public static let surfaceElevated = ColorValue(hue: 220, saturation: 12, lightness: 10, alpha: 1, red: 0.088, green: 0.096, blue: 0.112)
            public static let surfaceOverlay = ColorValue(hue: 210, saturation: 10, lightness: 14, alpha: 1, red: 0.126, green: 0.14, blue: 0.154)
            public static let text = ColorValue(hue: 200, saturation: 7, lightness: 91, alpha: 1, red: 0.9037, green: 0.9121, blue: 0.9163)
            public static let textSecondary = ColorValue(hue: 210, saturation: 11, lightness: 60, alpha: 1, red: 0.556, green: 0.6, blue: 0.644)
            public static let icon = ColorValue(hue: 210, saturation: 11, lightness: 71, alpha: 1, red: 0.6781, green: 0.71, blue: 0.7419)
            public static let tint = ColorValue(hue: 204, saturation: 88, lightness: 53, alpha: 1, red: 0.1164, green: 0.61272, blue: 0.9436)
            public static let tintHover = ColorValue(hue: 204, saturation: 88, lightness: 62, alpha: 1, red: 0.2856, green: 0.68688, blue: 0.9544)
            public static let tintActive = ColorValue(hue: 204, saturation: 88, lightness: 39, alpha: 1, red: 0.0468, green: 0.45864, blue: 0.7332)
            public static let tintSubtle = ColorValue(hue: 204, saturation: 88, lightness: 53, alpha: 0.14, red: 0.1164, green: 0.61272, blue: 0.9436)
            public static let tintMuted = ColorValue(hue: 204, saturation: 88, lightness: 53, alpha: 0.28, red: 0.1164, green: 0.61272, blue: 0.9436)
            public static let tintHighlight = ColorValue(hue: 204, saturation: 88, lightness: 53, alpha: 0.2, red: 0.1164, green: 0.61272, blue: 0.9436)
            public static let onPrimary = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let onDestructive = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let onSuccess = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 1, red: 0, green: 0, blue: 0)
            public static let onWarning = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 1, red: 0, green: 0, blue: 0)
            public static let onInfo = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 1, red: 0, green: 0, blue: 0)
            public static let onTintScrim = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 0.4, red: 0, green: 0, blue: 0)
            public static let interactiveHover = ColorValue(hue: 200, saturation: 7, lightness: 91, alpha: 0.06, red: 0.9037, green: 0.9121, blue: 0.9163)
            public static let interactivePress = ColorValue(hue: 200, saturation: 7, lightness: 91, alpha: 0.12, red: 0.9037, green: 0.9121, blue: 0.9163)
            public static let border = ColorValue(hue: 210, saturation: 7, lightness: 18, alpha: 1, red: 0.1674, green: 0.18, blue: 0.1926)
            public static let outline = ColorValue(hue: 210, saturation: 8, lightness: 28, alpha: 1, red: 0.2576, green: 0.28, blue: 0.3024)
            public static let focusRing = ColorValue(hue: 204, saturation: 88, lightness: 53, alpha: 0.7, red: 0.1164, green: 0.61272, blue: 0.9436)
            public static let tabIconDefault = ColorValue(hue: 210, saturation: 11, lightness: 60, alpha: 1, red: 0.556, green: 0.6, blue: 0.644)
            public static let tabIconSelected = ColorValue(hue: 200, saturation: 7, lightness: 91, alpha: 1, red: 0.9037, green: 0.9121, blue: 0.9163)
            public static let destructive = ColorValue(hue: 356, saturation: 91, lightness: 66, alpha: 1, red: 0.9694, green: 0.3506, blue: 0.391853)
            public static let destructiveActive = ColorValue(hue: 356, saturation: 78, lightness: 46, alpha: 1, red: 0.8188, green: 0.1012, blue: 0.14904)
            public static let destructiveSurface = ColorValue(hue: 356, saturation: 91, lightness: 54, alpha: 0.16, red: 0.9586, green: 0.1214, blue: 0.177213)
            public static let success = ColorValue(hue: 160, saturation: 100, lightness: 36, alpha: 1, red: 0, green: 0.72, blue: 0.48)
            public static let successSurface = ColorValue(hue: 160, saturation: 100, lightness: 36, alpha: 0.16, red: 0, green: 0.72, blue: 0.48)
            public static let warning = ColorValue(hue: 50, saturation: 100, lightness: 50, alpha: 1, red: 1, green: 0.833333, blue: 0)
            public static let warningSurface = ColorValue(hue: 50, saturation: 100, lightness: 50, alpha: 0.16, red: 1, green: 0.833333, blue: 0)
            public static let info = ColorValue(hue: 204, saturation: 88, lightness: 53, alpha: 1, red: 0.1164, green: 0.61272, blue: 0.9436)
            public static let infoSurface = ColorValue(hue: 204, saturation: 88, lightness: 53, alpha: 0.14, red: 0.1164, green: 0.61272, blue: 0.9436)
            public static let disabled = ColorValue(hue: 210, saturation: 10, lightness: 16, alpha: 1, red: 0.144, green: 0.16, blue: 0.176)
            public static let scrim = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 0.72, red: 0, green: 0, blue: 0)
            public static let shadowColor = ColorValue(hue: 0, saturation: 0, lightness: 0, alpha: 0.5, red: 0, green: 0, blue: 0)
        }
    }
    public enum Tone {
        public enum Text {
            public static let `default` = ColorValue(hue: 210, saturation: 25, lightness: 7, alpha: 1, red: 0.0525, green: 0.07, blue: 0.0875)
            public static let secondary = ColorValue(hue: 206, saturation: 13, lightness: 37, alpha: 1, red: 0.3219, green: 0.376413, blue: 0.4181)
            public static let tint = ColorValue(hue: 204, saturation: 88, lightness: 37, alpha: 1, red: 0.0444, green: 0.43512, blue: 0.6956)
            public static let destructive = ColorValue(hue: 356, saturation: 78, lightness: 44, alpha: 1, red: 0.7832, green: 0.0968, blue: 0.14256)
            public static let success = ColorValue(hue: 160, saturation: 100, lightness: 23, alpha: 1, red: 0, green: 0.46, blue: 0.306667)
            public static let warning = ColorValue(hue: 30, saturation: 100, lightness: 30, alpha: 1, red: 0.6, green: 0.3, blue: 0)
            public static let info = ColorValue(hue: 204, saturation: 88, lightness: 37, alpha: 1, red: 0.0444, green: 0.43512, blue: 0.6956)
            public static let onPrimary = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
        }
        public enum Surface {
            public static let background = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let surface = ColorValue(hue: 180, saturation: 14, lightness: 97, alpha: 1, red: 0.9658, green: 0.9742, blue: 0.9742)
            public static let muted = ColorValue(hue: 195, saturation: 15, lightness: 94, alpha: 1, red: 0.931, green: 0.9445, blue: 0.949)
            public static let sunken = ColorValue(hue: 195, saturation: 15, lightness: 94, alpha: 1, red: 0.931, green: 0.9445, blue: 0.949)
            public static let elevated = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let overlay = ColorValue(hue: 0, saturation: 0, lightness: 100, alpha: 1, red: 1, green: 1, blue: 1)
            public static let tintSubtle = ColorValue(hue: 204, saturation: 88, lightness: 53, alpha: 0.1, red: 0.1164, green: 0.61272, blue: 0.9436)
            public static let destructive = ColorValue(hue: 356, saturation: 91, lightness: 54, alpha: 0.1, red: 0.9586, green: 0.1214, blue: 0.177213)
            public static let success = ColorValue(hue: 160, saturation: 100, lightness: 36, alpha: 0.12, red: 0, green: 0.72, blue: 0.48)
            public static let warning = ColorValue(hue: 50, saturation: 100, lightness: 50, alpha: 0.18, red: 1, green: 0.833333, blue: 0)
            public static let info = ColorValue(hue: 204, saturation: 88, lightness: 53, alpha: 0.1, red: 0.1164, green: 0.61272, blue: 0.9436)
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
            public static let n0_5 = Quantity(value: 2, unit: "px")
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
            public static let n2xs = Quantity(value: 2, unit: "px")
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
            public static let display = ["Bricolage Grotesque", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"]
            public static let mono = ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "Liberation Mono", "monospace"]
        }
        public enum Size {
            public static let xs = Quantity(value: 12, unit: "px")
            public static let sm = Quantity(value: 14, unit: "px")
            public static let base = Quantity(value: 16, unit: "px")
            public static let lg = Quantity(value: 18, unit: "px")
            public static let xl = Quantity(value: 21, unit: "px")
            public static let n2xl = Quantity(value: 24, unit: "px")
            public static let n3xl = Quantity(value: 36, unit: "px")
            public static let n4xl = Quantity(value: 48, unit: "px")
        }
        public enum Leading {
            public static let xs = Quantity(value: 16, unit: "px")
            public static let sm = Quantity(value: 20, unit: "px")
            public static let base = Quantity(value: 24, unit: "px")
            public static let lg = Quantity(value: 24, unit: "px")
            public static let xl = Quantity(value: 28, unit: "px")
            public static let n2xl = Quantity(value: 28, unit: "px")
            public static let n3xl = Quantity(value: 40, unit: "px")
            public static let n4xl = Quantity(value: 52, unit: "px")
        }
        public enum LineHeight {
            public static let tight = 1.25
            public static let normal = 1.5
            public static let relaxed = 1.75
        }
        public enum Weight {
            public static let regular = 400
            public static let medium = 500
            public static let semibold = 600
            public static let bold = 700
            public static let heavy = 750
            public static let black = 800
        }
    }
    public enum Radius {
        public enum Scale {
            public static let none = Quantity(value: 0, unit: "px")
            public static let xs = Quantity(value: 6, unit: "px")
            public static let sm = Quantity(value: 8, unit: "px")
            public static let md = Quantity(value: 12, unit: "px")
            public static let lg = Quantity(value: 20, unit: "px")
            public static let xl = Quantity(value: 28, unit: "px")
            public static let n2xl = Quantity(value: 36, unit: "px")
            public static let full = Quantity(value: 9999, unit: "px")
        }
        public enum Role {
            public static let none = Quantity(value: 0, unit: "px")
            public static let sm = Quantity(value: 8, unit: "px")
            public static let control = Quantity(value: 12, unit: "px")
            public static let card = Quantity(value: 20, unit: "px")
            public static let sheet = Quantity(value: 28, unit: "px")
            public static let full = Quantity(value: 9999, unit: "px")
        }
    }
    public enum Motion {
        public enum Duration {
            public static let instant = Quantity(value: 0, unit: "ms")
            public static let fast = Quantity(value: 120, unit: "ms")
            public static let normal = Quantity(value: 200, unit: "ms")
            public static let slow = Quantity(value: 280, unit: "ms")
            public static let slower = Quantity(value: 600, unit: "ms")
        }
        public enum Easing {
            public static let standard = Bezier(x1: 0.2, y1: 0, x2: 0, y2: 1)
            public static let decelerate = Bezier(x1: 0, y1: 0, x2: 0, y2: 1)
            public static let accelerate = Bezier(x1: 0.3, y1: 0, x2: 1, y2: 1)
            public static let inOut = Bezier(x1: 0.4, y1: 0, x2: 0.2, y2: 1)
            public static let playful = Bezier(x1: 0.34, y1: 1.4, x2: 0.64, y2: 1)
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
            public static let sm = Quantity(value: 36, unit: "px")
            public static let md = Quantity(value: 48, unit: "px")
            public static let lg = Quantity(value: 56, unit: "px")
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
}
