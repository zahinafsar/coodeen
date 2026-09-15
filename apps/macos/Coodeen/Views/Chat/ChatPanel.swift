import SwiftUI

struct ChatPanel: View {
    @Environment(Workspace.self) private var workspace
    @Environment(ToastCenter.self) private var toasts
    @State private var lastErrorCounter = 0

    var body: some View {
        let view = workspace.chatView

        VStack(spacing: 0) {
            if view.messages.isEmpty {
                VStack(spacing: 40) {
                    Spacer()
                    Image("Logo")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxWidth: 420)
                        .frame(minWidth: 200)
                        .opacity(0.8)
                        .padding(.horizontal, 40)
                    PromptInput(variant: .landing, working: view.working)
                    Spacer()
                    Spacer()
                }
                .padding(.horizontal, 24)
                .frame(maxWidth: 680)
                .frame(maxWidth: .infinity)
            } else {
                MessageList(messages: view.messages, working: view.working)
                PromptInput(variant: .standard, working: view.working)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.background)
        .onChange(of: workspace.chat.errorCounter(workspace.sessionId)) { _, newValue in
            if newValue > lastErrorCounter, let error = view.error {
                toasts.error(error)
            }
            lastErrorCounter = newValue
        }
        .onChange(of: workspace.sessionId) { _, _ in
            lastErrorCounter = workspace.chat.errorCounter(workspace.sessionId)
        }
    }
}
