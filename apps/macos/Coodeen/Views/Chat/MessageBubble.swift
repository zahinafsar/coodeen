import SwiftUI

struct MessageBubble: View {
    let message: ChatMessage

    var body: some View {
        if message.info.isUser {
            UserBubble(message: message)
        } else {
            AssistantStack(message: message)
        }
    }
}

private struct BubbleShape: Shape {
    let tailLeading: Bool

    func path(in rect: CGRect) -> Path {
        let r: CGFloat = 16
        let small: CGFloat = 4
        var topLeft = r
        var topRight = r
        var bottomLeft = r
        var bottomRight = r
        if tailLeading {
            bottomLeft = small
        } else {
            bottomRight = small
        }
        topLeft = min(topLeft, rect.height / 2)
        topRight = min(topRight, rect.height / 2)
        bottomLeft = min(bottomLeft, rect.height / 2)
        bottomRight = min(bottomRight, rect.height / 2)
        return Path(roundedRect: rect, cornerRadii: RectangleCornerRadii(
            topLeading: topLeft,
            bottomLeading: bottomLeft,
            bottomTrailing: bottomRight,
            topTrailing: topRight
        ))
    }
}

private struct UserBubble: View {
    let message: ChatMessage

    var body: some View {
        let images = message.parts.filter { $0.type == "file" && $0.mime.hasPrefix("image/") }
        let text = message.parts
            .filter { $0.type == "text" && !$0.synthetic }
            .map(\.text)
            .joined()

        HStack {
            Spacer(minLength: 60)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(images) { img in
                    AttachmentImage(source: img.url)
                }
                if !text.isEmpty {
                    Text(text)
                        .font(.system(size: 13))
                        .lineSpacing(3)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .foregroundStyle(Palette.primaryForeground)
            .background(BubbleShape(tailLeading: false).fill(Palette.primary))
        }
    }
}

private enum AssistantGroup: Identifiable {
    case tools([MessagePart])
    case text(MessagePart)
    case file(MessagePart)

    var id: String {
        switch self {
        case .tools(let items):
            return "tools-\(items.first?.id ?? "")"
        case .text(let part):
            return part.id
        case .file(let part):
            return part.id
        }
    }
}

private struct AssistantStack: View {
    let message: ChatMessage

    var body: some View {
        let visible = message.parts.filter(\.isRenderable)
        let streaming = message.info.completed == nil
        let groups = Self.groups(visible)

        if !visible.isEmpty || streaming {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(groups) { group in
                    switch group {
                    case .tools(let items):
                        ToolTimeline(parts: items)
                    case .text(let part):
                        TextPartView(part: part, streaming: streaming)
                    case .file(let part):
                        AssistantBubbleContainer {
                            AttachmentImage(source: part.url)
                        }
                    }
                }
                if visible.isEmpty && streaming {
                    AssistantBubbleContainer {
                        ThinkingDots()
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.trailing, 40)
        }
    }

    static func groups(_ parts: [MessagePart]) -> [AssistantGroup] {
        var out: [AssistantGroup] = []
        for part in parts {
            if part.type == "reasoning" {
                continue
            }
            if part.type == "tool" {
                if case .tools(let items) = out.last {
                    out[out.count - 1] = .tools(items + [part])
                } else {
                    out.append(.tools([part]))
                }
            } else if part.type == "text" {
                out.append(.text(part))
            } else if part.type == "file" {
                out.append(.file(part))
            }
        }
        return out
    }
}

struct AssistantBubbleContainer<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        content()
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .foregroundStyle(Palette.foreground)
            .background(BubbleShape(tailLeading: true).fill(Palette.muted))
    }
}

private struct TextPartView: View {
    let part: MessagePart
    let streaming: Bool

    @State private var shownCount = 0
    @State private var targetCount = 0
    @State private var live = false
    @State private var ticking = false

    var body: some View {
        let target = part.text
        let shown = displayed(target)

        AssistantBubbleContainer {
            VStack(alignment: .leading, spacing: 0) {
                MarkdownContent(text: shown)
                if streaming && !shown.isEmpty && shown.count < target.count {
                    RoundedRectangle(cornerRadius: 1)
                        .fill(Palette.mutedForeground)
                        .frame(width: 8, height: 16)
                        .opacity(0.8)
                }
            }
        }
        .onAppear {
            targetCount = target.count
            live = streaming
            if !streaming {
                shownCount = target.count
            } else {
                startTicking()
            }
        }
        .onChange(of: target) { _, newValue in
            targetCount = newValue.count
            if !streaming {
                shownCount = newValue.count
                return
            }
            if newValue.count < shownCount {
                shownCount = newValue.count
                return
            }
            startTicking()
        }
        .onChange(of: streaming) { _, isStreaming in
            live = isStreaming
            if !isStreaming {
                shownCount = targetCount
            } else {
                startTicking()
            }
        }
    }

    private func displayed(_ target: String) -> String {
        if !streaming {
            return target
        }
        return String(target.prefix(shownCount))
    }

    private func startTicking() {
        if ticking {
            return
        }
        ticking = true
        Task { @MainActor in
            while true {
                let remaining = targetCount - shownCount
                if remaining <= 0 || !live {
                    break
                }
                let step = max(1, min(remaining, Int(ceil(Double(remaining) / 24))))
                shownCount += step
                try? await Task.sleep(nanoseconds: 24_000_000)
            }
            ticking = false
        }
    }
}

private struct ThinkingDots: View {
    @State private var animate = false

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(Palette.mutedForeground)
                    .frame(width: 6, height: 6)
                    .offset(y: animate ? -3 : 0)
                    .animation(
                        .easeInOut(duration: 0.45).repeatForever(autoreverses: true).delay(Double(i) * 0.15),
                        value: animate
                    )
            }
        }
        .padding(.vertical, 6)
        .onAppear {
            animate = true
        }
    }
}
