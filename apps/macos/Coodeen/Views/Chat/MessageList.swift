import SwiftUI

struct MessageList: View {
    let messages: [ChatMessage]
    let working: Bool

    @State private var nearBottom = true
    @State private var viewportHeight: CGFloat = 0

    private static let bottomID = "message-list-bottom"
    private static let space = "message-list-scroll"

    var body: some View {
        let merged = Self.mergeAssistantTurns(messages)

        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(merged) { message in
                        MessageBubble(message: message)
                            .frame(maxWidth: .infinity, alignment: message.info.isUser ? .trailing : .leading)
                    }
                    Color.clear
                        .frame(height: 1)
                        .id(Self.bottomID)
                        .background(
                            GeometryReader { geo in
                                Color.clear.preference(
                                    key: BottomOffsetKey.self,
                                    value: geo.frame(in: .named(Self.space)).maxY
                                )
                            }
                        )
                }
                .padding(16)
            }
            .coordinateSpace(name: Self.space)
            .background(
                GeometryReader { geo in
                    Color.clear
                        .onAppear {
                            viewportHeight = geo.size.height
                        }
                        .onChange(of: geo.size.height) { _, h in
                            viewportHeight = h
                        }
                }
            )
            .onPreferenceChange(BottomOffsetKey.self) { maxY in
                nearBottom = maxY - viewportHeight < 150
            }
            .onAppear {
                proxy.scrollTo(Self.bottomID, anchor: .bottom)
            }
            .onChange(of: Self.signature(messages)) { _, _ in
                if !nearBottom {
                    return
                }
                if working {
                    proxy.scrollTo(Self.bottomID, anchor: .bottom)
                } else {
                    withAnimation(.easeOut(duration: 0.25)) {
                        proxy.scrollTo(Self.bottomID, anchor: .bottom)
                    }
                }
            }
        }
    }

    static func signature(_ messages: [ChatMessage]) -> Int {
        var hasher = Hasher()
        hasher.combine(messages.count)
        if let last = messages.last {
            hasher.combine(last.id)
            hasher.combine(last.parts.count)
            if let part = last.parts.last {
                hasher.combine(part.text.count)
                hasher.combine(part.toolStatus.rawValue)
            }
            hasher.combine(last.info.completed)
        }
        return hasher.finalize()
    }

    static func mergeAssistantTurns(_ messages: [ChatMessage]) -> [ChatMessage] {
        var out: [ChatMessage] = []
        for message in messages {
            if let last = out.last, !last.info.isUser, !message.info.isUser {
                var merged = last
                merged.info.completed = message.info.completed
                merged.parts = last.parts + message.parts
                out[out.count - 1] = merged
            } else {
                out.append(message)
            }
        }
        return out
    }
}

private struct BottomOffsetKey: PreferenceKey {
    static var defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}
