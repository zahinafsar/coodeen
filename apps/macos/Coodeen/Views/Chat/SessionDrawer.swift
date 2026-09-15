import SwiftUI

struct SessionDrawer: View {
    @Environment(Workspace.self) private var workspace
    @Environment(ToastCenter.self) private var toasts

    @State private var sessions: [SessionItem] = []
    @State private var loading = false
    @State private var editingId: String?
    @State private var editingTitle = ""
    @State private var pendingDelete: SessionItem?
    @FocusState private var editFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("SESSIONS")
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(0.8)
                    .foregroundStyle(Palette.foreground)
                Spacer()
                Button {
                    workspace.newSession()
                    workspace.drawerOpen = false
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "plus")
                            .font(.system(size: 11))
                        Text("New")
                    }
                }
                .buttonStyle(OutlineButtonStyle(height: 30))
            }
            .padding(16)
            .cardBorder(.bottom)

            ScrollView {
                VStack(spacing: 2) {
                    if loading && sessions.isEmpty {
                        HStack(spacing: 8) {
                            SpinnerView(size: 14)
                            Text("Loading sessions...")
                        }
                        .font(.system(size: 13))
                        .foregroundStyle(Palette.mutedForeground)
                        .padding(.vertical, 32)
                    } else if sessions.isEmpty {
                        Text("No sessions yet.")
                            .font(.system(size: 13))
                            .foregroundStyle(Palette.mutedForeground)
                            .padding(.vertical, 32)
                    } else {
                        ForEach(sessions) { session in
                            row(session)
                        }
                    }
                }
                .padding(8)
            }
        }
        .background(Palette.background)
        .cardBorder(.trailing)
        .task(id: workspace.sessionsRevision) {
            await load()
        }
        .confirmationDialog(
            "Delete this session?",
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
            presenting: pendingDelete
        ) { session in
            Button("Delete", role: .destructive) {
                Task {
                    await delete(session)
                }
            }
            Button("Cancel", role: .cancel) {}
        }
    }

    @ViewBuilder
    private func row(_ session: SessionItem) -> some View {
        SessionRow(
            session: session,
            current: session.id == workspace.sessionId,
            editing: editingId == session.id,
            editingTitle: $editingTitle,
            editFocused: $editFocused,
            onSelect: {
                Task {
                    workspace.drawerOpen = false
                    await workspace.loadSession(session)
                }
            },
            onEdit: {
                editingId = session.id
                editingTitle = session.title
                editFocused = true
            },
            onSave: {
                Task {
                    await saveTitle(session)
                }
            },
            onCancel: {
                editingId = nil
                editingTitle = ""
            },
            onDelete: {
                pendingDelete = session
            }
        )
    }

    private func load() async {
        loading = true
        do {
            sessions = try await OpencodeAPI.listSessions()
        } catch {
        }
        loading = false
    }

    private func saveTitle(_ session: SessionItem) async {
        let trimmed = editingTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        editingId = nil
        if !trimmed.isEmpty && trimmed != session.title {
            do {
                try await OpencodeAPI.renameSession(session.id, title: trimmed, projectDir: session.projectDir)
                if let idx = sessions.firstIndex(where: { $0.id == session.id }) {
                    sessions[idx].title = trimmed
                }
            } catch {
                toasts.error(error.localizedDescription)
            }
        }
        editingTitle = ""
    }

    private func delete(_ session: SessionItem) async {
        do {
            try await OpencodeAPI.deleteSession(session.id)
            sessions.removeAll { $0.id == session.id }
            workspace.sessionDeleted(session.id)
        } catch {
            toasts.error(error.localizedDescription)
        }
    }
}

private struct SessionRow: View {
    let session: SessionItem
    let current: Bool
    let editing: Bool
    @Binding var editingTitle: String
    var editFocused: FocusState<Bool>.Binding
    let onSelect: () -> Void
    let onEdit: () -> Void
    let onSave: () -> Void
    let onCancel: () -> Void
    let onDelete: () -> Void

    @State private var hovering = false

    var body: some View {
        HStack(spacing: 0) {
            if editing {
                TextField("", text: $editingTitle)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13))
                    .padding(.horizontal, 10)
                    .frame(height: 32)
                    .background(RoundedRectangle(cornerRadius: 4).fill(Palette.background))
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(Palette.border, lineWidth: 1))
                    .focused(editFocused)
                    .onSubmit(onSave)
                    .onExitCommand(perform: onCancel)
                    .onChange(of: editFocused.wrappedValue) { _, focused in
                        if !focused && editing {
                            onSave()
                        }
                    }
            } else {
                Button(action: onSelect) {
                    Text(session.title)
                        .font(.system(size: 13))
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }

            if hovering && !editing {
                Button(action: onEdit) {
                    Image(systemName: "pencil")
                        .font(.system(size: 12))
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .foregroundStyle(Palette.mutedForeground)
                .help("Edit session title")

                Button(action: onDelete) {
                    Image(systemName: "trash")
                        .font(.system(size: 12))
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .foregroundStyle(Palette.mutedForeground)
                .help("Delete session")
            }
        }
        .foregroundStyle(current || hovering ? Palette.foreground : Palette.mutedForeground)
        .background(
            RoundedRectangle(cornerRadius: Palette.radiusSm)
                .fill(current ? Palette.accent : (hovering ? Palette.accent.opacity(0.5) : Color.clear))
        )
        .onHover { hovering = $0 }
    }
}
