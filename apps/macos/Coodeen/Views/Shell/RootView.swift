import SwiftUI

struct RootView: View {
    @Environment(Workspace.self) private var workspace
    @Environment(\.openSettings) private var openSettings

    var body: some View {
        @Bindable var workspace = workspace

        ZStack(alignment: .topLeading) {
            MainView()
                .background(Palette.background)

            if workspace.drawerOpen {
                Color.black.opacity(0.5)
                    .ignoresSafeArea()
                    .onTapGesture {
                        workspace.drawerOpen = false
                    }
                    .transition(.opacity)
                SessionDrawer()
                    .frame(width: 320)
                    .frame(maxHeight: .infinity)
                    .transition(.move(edge: .leading))
            }
        }
        .animation(.easeOut(duration: 0.18), value: workspace.drawerOpen)
        .overlay(alignment: .bottomTrailing) {
            ToastOverlay()
                .padding(16)
        }
        .toolbar {
            TopBar()
        }
        .toolbarBackground(Palette.card, for: .windowToolbar)
        .toolbarBackground(.visible, for: .windowToolbar)
        .alert("Pick a model", isPresented: $workspace.needsModelAlert) {
            Button("Close", role: .cancel) {}
            Button("Open Settings") {
                openSettings()
            }
        } message: {
            Text("Choose a provider and model before sending. Add API keys in Settings.")
        }
    }
}

struct TopBar: ToolbarContent {
    @Environment(Workspace.self) private var workspace
    @Environment(\.openSettings) private var openSettings

    var body: some ToolbarContent {
        ToolbarItem(placement: .navigation) {
            Button {
                workspace.drawerOpen.toggle()
            } label: {
                Label("Sessions", systemImage: "sidebar.left")
            }
            .help("Sessions")
        }

        if #available(macOS 26.0, *) {
            ToolbarSpacer(.flexible)
        }

        ToolbarItemGroup(placement: .primaryAction) {
            ForEach(workspace.actions) { action in
                Button {
                    workspace.runAction(action)
                } label: {
                    HStack(spacing: 6) {
                        if workspace.runningAction == action.label {
                            SpinnerView(size: 10)
                        }
                        Text(action.label)
                            .font(.system(size: 12))
                    }
                }
                .disabled(workspace.runningAction == action.label)
                .help(action.script)
            }

            Button {
                openSettings()
            } label: {
                Label("Settings", systemImage: "gearshape")
            }
            .help("Settings")

            Button {
                workspace.rightPanelOpen.toggle()
            } label: {
                Label("Preview", systemImage: "sidebar.right")
            }
            .help(workspace.rightPanelOpen ? "Hide preview" : "Show preview")
        }
    }
}

struct ToastOverlay: View {
    @Environment(ToastCenter.self) private var toasts

    var body: some View {
        VStack(alignment: .trailing, spacing: 8) {
            ForEach(toasts.toasts) { toast in
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: icon(for: toast.kind))
                        .foregroundStyle(color(for: toast.kind))
                        .font(.system(size: 13))
                    Text(toast.message)
                        .font(.system(size: 13))
                        .foregroundStyle(Palette.foreground)
                        .fixedSize(horizontal: false, vertical: true)
                        .lineLimit(6)
                        .textSelection(.enabled)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .frame(maxWidth: 360, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: Palette.radius).fill(Palette.card))
                .overlay(RoundedRectangle(cornerRadius: Palette.radius).stroke(Palette.border, lineWidth: 1))
                .shadow(color: .black.opacity(0.4), radius: 12, y: 4)
                .onTapGesture {
                    toasts.dismiss(toast.id)
                }
                .transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
        .animation(.easeOut(duration: 0.2), value: toasts.toasts)
    }

    private func icon(for kind: Toast.Kind) -> String {
        switch kind {
        case .success:
            return "checkmark.circle.fill"
        case .error:
            return "exclamationmark.circle.fill"
        case .info:
            return "info.circle.fill"
        }
    }

    private func color(for kind: Toast.Kind) -> Color {
        switch kind {
        case .success:
            return Palette.emerald
        case .error:
            return Palette.red
        case .info:
            return Palette.blue
        }
    }
}
