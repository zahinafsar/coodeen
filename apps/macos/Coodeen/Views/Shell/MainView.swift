import SwiftUI

struct MainView: View {
    @Environment(Workspace.self) private var workspace
    @State private var chatFraction: CGFloat = 0.5

    var body: some View {
        SplitView(
            axis: .horizontal,
            fraction: $chatFraction,
            minFirst: 320,
            minSecond: 260,
            secondCollapsed: !workspace.rightPanelOpen
        ) {
            ChatPanel()
        } second: {
            RightColumn()
        }
    }
}

struct RightColumn: View {
    @Environment(Workspace.self) private var workspace
    @State private var topFraction: CGFloat = 0.6

    var body: some View {
        @Bindable var workspace = workspace

        VStack(spacing: 0) {
            HStack(spacing: 0) {
                ForEach(RightTab.allCases) { tab in
                    TabHeaderButton(title: tab.rawValue, active: workspace.rightTab == tab) {
                        workspace.rightTab = tab
                    }
                }
                Spacer()
            }
            .background(Palette.card)
            .cardBorder(.bottom)

            SplitView(
                axis: .vertical,
                fraction: $topFraction,
                minFirst: 120,
                minSecond: 80,
                secondCollapsed: !workspace.terminalOpen
            ) {
                tabContent
            } second: {
                TerminalTabsView()
            }
        }
    }

    @ViewBuilder
    private var tabContent: some View {
        switch workspace.rightTab {
        case .preview:
            PreviewPanel()
        case .design:
            DesignCanvasView()
        case .files:
            FileExplorerPanel()
        case .git:
            GitManagerPanel()
        }
    }
}

struct TabHeaderButton: View {
    let title: String
    let active: Bool
    var fontSize: CGFloat = 13
    var verticalPadding: CGFloat = 8
    let action: () -> Void

    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: fontSize, weight: .medium))
                .foregroundStyle(active || hovering ? Palette.foreground : Palette.mutedForeground)
                .padding(.horizontal, 14)
                .padding(.vertical, verticalPadding)
                .overlay(alignment: .bottom) {
                    Rectangle()
                        .fill(active ? Palette.primary : Color.clear)
                        .frame(height: 2)
                }
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
    }
}
