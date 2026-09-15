import SwiftUI
import AppKit
import SwiftTerm

struct TerminalTabsView: View {
    @Environment(Workspace.self) private var workspace
    @Environment(TerminalManager.self) private var terminals

    var body: some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 0) {
                    ForEach(terminals.sessions) { session in
                        TerminalTab(
                            label: session.label,
                            active: session.id == terminals.activeId,
                            onSelect: {
                                terminals.activeId = session.id
                            },
                            onClose: {
                                terminals.close(session.id)
                            }
                        )
                    }
                    Button {
                        terminals.add(workspace.projectDir)
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 12))
                            .frame(width: 28, height: 32)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(Palette.mutedForeground)
                    .help("New terminal")
                }
            }
            .frame(height: 32)
            .background(Palette.card)
            .cardBorder(.bottom)

            ZStack {
                if terminals.sessions.isEmpty {
                    Text("Select a project folder to open a terminal.")
                        .font(.system(size: 12))
                        .foregroundStyle(Palette.mutedForeground)
                } else {
                    TerminalHost(sessions: terminals.sessions, activeId: terminals.activeId)
                        .padding(4)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(red: 10 / 255, green: 10 / 255, blue: 10 / 255))
        }
        .onAppear {
            terminals.syncProjectDir(workspace.projectDir)
        }
        .onChange(of: workspace.projectDir) { _, dir in
            terminals.syncProjectDir(dir)
        }
    }
}

private struct TerminalTab: View {
    let label: String
    let active: Bool
    let onSelect: () -> Void
    let onClose: () -> Void
    @State private var hovering = false

    var body: some View {
        HStack(spacing: 4) {
            Text(label)
                .font(.system(size: 12, design: .monospaced))
                .lineLimit(1)
                .frame(maxWidth: 160, alignment: .leading)
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .semibold))
                    .frame(width: 18, height: 18)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help("Close terminal")
        }
        .padding(.leading, 12)
        .padding(.trailing, 4)
        .frame(height: 32)
        .foregroundStyle(active || hovering ? Palette.foreground : Palette.mutedForeground)
        .background(active ? Palette.background : Color.clear)
        .cardBorder(.trailing)
        .contentShape(Rectangle())
        .onTapGesture(perform: onSelect)
        .onHover { hovering = $0 }
    }
}

private struct TerminalHost: NSViewRepresentable {
    let sessions: [TerminalSession]
    let activeId: UUID?

    func makeNSView(context: Context) -> TerminalContainerView {
        TerminalContainerView()
    }

    func updateNSView(_ container: TerminalContainerView, context: Context) {
        container.update(sessions: sessions, activeId: activeId)
    }

    static func dismantleNSView(_ container: TerminalContainerView, coordinator: ()) {
        container.detachAll()
    }
}

final class TerminalContainerView: NSView {
    private var activeId: UUID?

    func update(sessions: [TerminalSession], activeId: UUID?) {
        let ids = Set(sessions.map { ObjectIdentifier($0.view) })
        for sub in subviews where !ids.contains(ObjectIdentifier(sub)) {
            sub.removeFromSuperview()
        }
        for session in sessions {
            if session.view.superview !== self {
                session.view.removeFromSuperview()
                session.view.frame = bounds
                session.view.autoresizingMask = [.width, .height]
                addSubview(session.view)
            }
            session.view.isHidden = session.id != activeId
        }
        if self.activeId != activeId {
            self.activeId = activeId
            if let active = sessions.first(where: { $0.id == activeId }) {
                DispatchQueue.main.async {
                    active.view.window?.makeFirstResponder(active.view)
                }
            }
        }
    }

    func detachAll() {
        for sub in subviews {
            sub.removeFromSuperview()
        }
    }

    override func layout() {
        super.layout()
        for sub in subviews {
            sub.frame = bounds
        }
    }
}
