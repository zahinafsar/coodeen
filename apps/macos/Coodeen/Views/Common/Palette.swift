import SwiftUI

enum Palette {
    static let background = Color(red: 10 / 255, green: 10 / 255, blue: 10 / 255)
    static let card = Color(red: 10 / 255, green: 10 / 255, blue: 10 / 255)
    static let foreground = Color(red: 250 / 255, green: 250 / 255, blue: 250 / 255)
    static let primary = Color(red: 250 / 255, green: 250 / 255, blue: 250 / 255)
    static let primaryForeground = Color(red: 23 / 255, green: 23 / 255, blue: 23 / 255)
    static let secondary = Color(red: 38 / 255, green: 38 / 255, blue: 38 / 255)
    static let muted = Color(red: 38 / 255, green: 38 / 255, blue: 38 / 255)
    static let mutedForeground = Color(red: 161 / 255, green: 161 / 255, blue: 161 / 255)
    static let accent = Color(red: 38 / 255, green: 38 / 255, blue: 38 / 255)
    static let border = Color(red: 38 / 255, green: 38 / 255, blue: 38 / 255)
    static let ring = Color(red: 115 / 255, green: 115 / 255, blue: 115 / 255)
    static let destructive = Color(red: 130 / 255, green: 24 / 255, blue: 26 / 255)
    static let codeBackground = Color(red: 10 / 255, green: 10 / 255, blue: 15 / 255)

    static let amber = Color(red: 251 / 255, green: 191 / 255, blue: 36 / 255)
    static let emerald = Color(red: 52 / 255, green: 211 / 255, blue: 153 / 255)
    static let red = Color(red: 248 / 255, green: 113 / 255, blue: 113 / 255)
    static let blue = Color(red: 96 / 255, green: 165 / 255, blue: 250 / 255)
    static let green = Color(red: 74 / 255, green: 222 / 255, blue: 128 / 255)
    static let purple = Color(red: 192 / 255, green: 132 / 255, blue: 252 / 255)
    static let cyan = Color(red: 34 / 255, green: 211 / 255, blue: 238 / 255)
    static let neutral = Color(red: 163 / 255, green: 163 / 255, blue: 163 / 255)

    static let radius: CGFloat = 10
    static let radiusSm: CGFloat = 6
    static let radiusMd: CGFloat = 8
}

struct HoverButtonStyle: ButtonStyle {
    var active = false
    var padding: CGFloat = 6

    func makeBody(configuration: Configuration) -> some View {
        HoverBody(configuration: configuration, active: active, padding: padding)
    }

    private struct HoverBody: View {
        let configuration: Configuration
        let active: Bool
        let padding: CGFloat
        @State private var hovering = false
        @Environment(\.isEnabled) private var isEnabled

        var body: some View {
            configuration.label
                .padding(padding)
                .foregroundStyle(foreground)
                .background(
                    RoundedRectangle(cornerRadius: Palette.radiusSm)
                        .fill(background)
                )
                .contentShape(Rectangle())
                .opacity(isEnabled ? 1 : 0.5)
                .onHover { hovering = $0 }
        }

        private var foreground: Color {
            if active || hovering {
                return Palette.foreground
            }
            return Palette.mutedForeground
        }

        private var background: Color {
            if configuration.isPressed {
                return Palette.accent.opacity(0.9)
            }
            if active || hovering {
                return Palette.accent
            }
            return .clear
        }
    }
}

struct OutlineButtonStyle: ButtonStyle {
    var height: CGFloat = 28

    func makeBody(configuration: Configuration) -> some View {
        OutlineBody(configuration: configuration, height: height)
    }

    private struct OutlineBody: View {
        let configuration: Configuration
        let height: CGFloat
        @State private var hovering = false
        @Environment(\.isEnabled) private var isEnabled

        var body: some View {
            configuration.label
                .font(.system(size: 12))
                .padding(.horizontal, 10)
                .frame(height: height)
                .foregroundStyle(hovering ? Palette.foreground : Palette.foreground.opacity(0.9))
                .background(
                    RoundedRectangle(cornerRadius: Palette.radiusSm)
                        .fill(hovering || configuration.isPressed ? Palette.accent : Color.clear)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Palette.radiusSm)
                        .stroke(Palette.border, lineWidth: 1)
                )
                .contentShape(Rectangle())
                .opacity(isEnabled ? 1 : 0.5)
                .onHover { hovering = $0 }
        }
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    var height: CGFloat = 28
    var destructive = false

    func makeBody(configuration: Configuration) -> some View {
        PrimaryBody(configuration: configuration, height: height, destructive: destructive)
    }

    private struct PrimaryBody: View {
        let configuration: Configuration
        let height: CGFloat
        let destructive: Bool
        @Environment(\.isEnabled) private var isEnabled

        var body: some View {
            configuration.label
                .font(.system(size: 12, weight: .medium))
                .padding(.horizontal, 12)
                .frame(height: height)
                .foregroundStyle(foreground)
                .background(
                    RoundedRectangle(cornerRadius: Palette.radiusSm)
                        .fill(fill.opacity(configuration.isPressed ? 0.85 : 1))
                )
                .contentShape(Rectangle())
                .opacity(isEnabled ? 1 : 0.5)
        }

        private var fill: Color {
            if destructive {
                return Palette.destructive
            }
            return Palette.primary
        }

        private var foreground: Color {
            if destructive {
                return Palette.foreground
            }
            return Palette.primaryForeground
        }
    }
}

struct BadgeView: View {
    let text: String
    var outline = false

    var body: some View {
        Text(text)
            .font(.system(size: 10, weight: .medium))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .foregroundStyle(Palette.foreground)
            .background(
                RoundedRectangle(cornerRadius: 4)
                    .fill(outline ? Color.clear : Palette.secondary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .stroke(outline ? Palette.border : Color.clear, lineWidth: 1)
            )
    }
}

struct ThemedTextField: View {
    let placeholder: String
    @Binding var text: String
    var monospaced = false
    var secure = false
    var height: CGFloat = 30
    var onSubmit: () -> Void = {}

    var body: some View {
        Group {
            if secure {
                SecureField(placeholder, text: $text)
            } else {
                TextField(placeholder, text: $text)
            }
        }
        .textFieldStyle(.plain)
        .font(monospaced ? .system(size: 12, design: .monospaced) : .system(size: 13))
        .padding(.horizontal, 8)
        .frame(height: height)
        .background(RoundedRectangle(cornerRadius: Palette.radiusSm).fill(Palette.background))
        .overlay(RoundedRectangle(cornerRadius: Palette.radiusSm).stroke(Palette.border, lineWidth: 1))
        .onSubmit(onSubmit)
    }
}

struct SpinnerView: View {
    var size: CGFloat = 12

    var body: some View {
        ProgressView()
            .controlSize(.mini)
            .frame(width: size, height: size)
            .scaleEffect(size / 16)
    }
}

extension View {
    func cardBorder(_ edges: Edge.Set) -> some View {
        overlay(alignment: .top) {
            if edges.contains(.top) {
                Rectangle().fill(Palette.border).frame(height: 1)
            }
        }
        .overlay(alignment: .bottom) {
            if edges.contains(.bottom) {
                Rectangle().fill(Palette.border).frame(height: 1)
            }
        }
        .overlay(alignment: .leading) {
            if edges.contains(.leading) {
                Rectangle().fill(Palette.border).frame(width: 1)
            }
        }
        .overlay(alignment: .trailing) {
            if edges.contains(.trailing) {
                Rectangle().fill(Palette.border).frame(width: 1)
            }
        }
    }
}
