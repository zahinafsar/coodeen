import SwiftUI

struct GitManagerPanel: View {
    @Environment(Workspace.self) private var workspace

    @State private var isRepo = false
    @State private var checked = false
    @State private var subTab = 0

    var body: some View {
        Group {
            if !checked {
                Color.clear
            } else if !isRepo {
                Text("Not a git repository")
                    .font(.system(size: 13))
                    .foregroundStyle(Palette.mutedForeground)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                VStack(spacing: 0) {
                    HStack(spacing: 0) {
                        TabHeaderButton(title: "Changes", active: subTab == 0, fontSize: 12, verticalPadding: 6) {
                            subTab = 0
                        }
                        TabHeaderButton(title: "Branches", active: subTab == 1, fontSize: 12, verticalPadding: 6) {
                            subTab = 1
                        }
                        Spacer()
                    }
                    .cardBorder(.bottom)

                    if subTab == 0 {
                        GitChangesTab(projectDir: workspace.projectDir)
                    } else {
                        GitBranchesTab(projectDir: workspace.projectDir)
                    }
                }
            }
        }
        .task(id: workspace.projectDir) {
            if workspace.projectDir.isEmpty {
                isRepo = false
                checked = true
                return
            }
            isRepo = await GitService.isRepo(workspace.projectDir)
            checked = true
        }
    }
}

private struct StatusBadge: View {
    let code: String

    var body: some View {
        Text(code)
            .font(.system(size: 10, weight: .bold, design: .monospaced))
            .padding(.horizontal, 5)
            .padding(.vertical, 1)
            .foregroundStyle(color)
            .background(RoundedRectangle(cornerRadius: 3).fill(color.opacity(0.2)))
    }

    private var color: Color {
        switch code {
        case "M":
            return Palette.amber
        case "A":
            return Palette.green
        case "D":
            return Palette.red
        case "R":
            return Palette.blue
        case "U":
            return Palette.purple
        case "C":
            return Palette.cyan
        default:
            return Palette.neutral
        }
    }
}

struct GitChangesTab: View {
    let projectDir: String

    @Environment(ToastCenter.self) private var toasts
    @State private var status = GitStatus(isGitRepo: false, branch: "", changes: [], ahead: 0, behind: 0)
    @State private var commitMessage = ""
    @State private var actionLoading: String?
    @State private var pendingDiscard: [String]?

    private var staged: [GitChange] {
        status.changes.filter { !$0.index.isEmpty && $0.index != "?" }
    }

    private var unstaged: [GitChange] {
        status.changes.filter { !$0.workTree.isEmpty || $0.index == "?" }
    }

    private var busy: Bool {
        actionLoading != nil
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Text(status.branch)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Palette.mutedForeground)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button {
                    Task {
                        await load()
                    }
                } label: {
                    if busy {
                        SpinnerView(size: 10)
                    } else {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 11))
                    }
                }
                .buttonStyle(HoverButtonStyle(padding: 5))
                .disabled(busy)

                Button {
                    run("pull", success: "Pulled from remote", failure: "Pull failed") {
                        try await GitService.pull(projectDir)
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.down")
                            .font(.system(size: 10))
                        Text("Pull")
                        if status.behind > 0 {
                            BadgeView(text: "\(status.behind)")
                        }
                    }
                }
                .buttonStyle(OutlineButtonStyle(height: 26))
                .disabled(busy)

                Button {
                    run("push", success: "Pushed to remote", failure: "Push failed") {
                        try await GitService.push(projectDir)
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 10))
                        Text("Push")
                        if status.ahead > 0 {
                            BadgeView(text: "\(status.ahead)")
                        }
                    }
                }
                .buttonStyle(OutlineButtonStyle(height: 26))
                .disabled(busy)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .cardBorder(.bottom)

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if !staged.isEmpty {
                        sectionHeader("Staged (\(staged.count))") {
                            Button("Unstage All") {
                                run("unstage", failure: "Failed to unstage files") {
                                    try await GitService.unstage(projectDir, staged.map(\.file))
                                }
                            }
                            .buttonStyle(HoverButtonStyle(padding: 4))
                            .font(.system(size: 11))
                            .disabled(busy)
                        }
                        ForEach(staged) { change in
                            ChangeRow(change: change, code: change.index) {
                                IconAction(icon: "minus", help: "Unstage") {
                                    run("unstage", failure: "Failed to unstage files") {
                                        try await GitService.unstage(projectDir, [change.file])
                                    }
                                }
                                .disabled(busy)
                            }
                        }
                    }

                    sectionHeader("Changes (\(unstaged.count))") {
                        if !unstaged.isEmpty {
                            IconAction(icon: "arrow.uturn.backward", help: "Discard All") {
                                pendingDiscard = unstaged.map(\.file)
                            }
                            .disabled(busy)
                            Button("Stage All") {
                                run("stage", failure: "Failed to stage files") {
                                    try await GitService.stage(projectDir, unstaged.map(\.file))
                                }
                            }
                            .buttonStyle(HoverButtonStyle(padding: 4))
                            .font(.system(size: 11))
                            .disabled(busy)
                        }
                    }
                    if unstaged.isEmpty {
                        Text("No changes")
                            .font(.system(size: 12))
                            .foregroundStyle(Palette.mutedForeground)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 24)
                    } else {
                        ForEach(unstaged) { change in
                            ChangeRow(change: change, code: change.workTree.isEmpty ? change.index : change.workTree) {
                                IconAction(icon: "arrow.uturn.backward", help: "Discard") {
                                    pendingDiscard = [change.file]
                                }
                                .disabled(busy)
                                IconAction(icon: "plus", help: "Stage") {
                                    run("stage", failure: "Failed to stage files") {
                                        try await GitService.stage(projectDir, [change.file])
                                    }
                                }
                                .disabled(busy)
                            }
                        }
                    }
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 8)
            }

            VStack(spacing: 8) {
                CommitMessageEditor(text: $commitMessage) {
                    commit()
                }
                Button {
                    commit()
                } label: {
                    Text(commitLabel)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(PrimaryButtonStyle(height: 30))
                .disabled(commitMessage.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || staged.isEmpty || busy)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .cardBorder(.top)
        }
        .task(id: projectDir) {
            await load()
        }
        .confirmationDialog(
            discardTitle,
            isPresented: Binding(get: { pendingDiscard != nil }, set: { if !$0 { pendingDiscard = nil } })
        ) {
            Button("Discard", role: .destructive) {
                if let files = pendingDiscard {
                    run("discard", success: "Changes discarded", failure: "Failed to discard changes") {
                        try await GitService.discard(projectDir, files)
                    }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This cannot be undone.")
        }
    }

    private var discardTitle: String {
        let count = pendingDiscard?.count ?? 0
        if count == 1 {
            return "Discard changes to 1 file?"
        }
        return "Discard changes to \(count) files?"
    }

    private var commitLabel: String {
        if actionLoading == "commit" {
            return "Committing..."
        }
        if staged.count == 1 {
            return "Commit (1 file)"
        }
        return "Commit (\(staged.count) files)"
    }

    private func sectionHeader<Actions: View>(_ title: String, @ViewBuilder actions: () -> Actions) -> some View {
        HStack(spacing: 4) {
            Text(title)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Palette.mutedForeground)
            Spacer()
            actions()
        }
        .padding(.top, 12)
        .padding(.bottom, 6)
    }

    private func load() async {
        status = await GitService.status(projectDir)
    }

    private func run(_ key: String, success: String? = nil, failure: String, _ body: @escaping () async throws -> Void) {
        actionLoading = key
        Task {
            do {
                try await body()
                if let success {
                    toasts.success(success)
                }
            } catch {
                toasts.error(failure)
            }
            await load()
            actionLoading = nil
        }
    }

    private func commit() {
        let message = commitMessage.trimmingCharacters(in: .whitespacesAndNewlines)
        if message.isEmpty {
            toasts.error("Commit message required")
            return
        }
        actionLoading = "commit"
        Task {
            do {
                try await GitService.commit(projectDir, message)
                toasts.success("Changes committed")
                commitMessage = ""
            } catch {
                toasts.error("Commit failed")
            }
            await load()
            actionLoading = nil
        }
    }
}

private struct ChangeRow<Actions: View>: View {
    let change: GitChange
    let code: String
    @ViewBuilder let actions: () -> Actions
    @State private var hovering = false

    var body: some View {
        HStack(spacing: 8) {
            StatusBadge(code: code)
            Text(change.file)
                .font(.system(size: 12))
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: .infinity, alignment: .leading)
                .help(change.file)
            HStack(spacing: 2) {
                actions()
            }
            .opacity(hovering ? 1 : 0)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(RoundedRectangle(cornerRadius: 4).fill(hovering ? Palette.muted.opacity(0.5) : Color.clear))
        .onHover { hovering = $0 }
    }
}

private struct IconAction: View {
    let icon: String
    let help: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 10))
                .frame(width: 12, height: 12)
        }
        .buttonStyle(HoverButtonStyle(padding: 4))
        .help(help)
    }
}

private struct CommitMessageEditor: View {
    @Binding var text: String
    let onCommit: () -> Void

    var body: some View {
        ZStack(alignment: .topLeading) {
            TextEditor(text: $text)
                .font(.system(size: 13))
                .scrollContentBackground(.hidden)
                .padding(.horizontal, 6)
                .padding(.vertical, 6)
            if text.isEmpty {
                Text("Commit message...")
                    .font(.system(size: 13))
                    .foregroundStyle(Palette.mutedForeground)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 6)
                    .allowsHitTesting(false)
            }
        }
        .frame(minHeight: 60, maxHeight: 120)
        .fixedSize(horizontal: false, vertical: true)
        .background(RoundedRectangle(cornerRadius: Palette.radiusSm).fill(Palette.background))
        .overlay(RoundedRectangle(cornerRadius: Palette.radiusSm).stroke(Palette.border, lineWidth: 1))
        .background(
            Button("") {
                onCommit()
            }
            .keyboardShortcut(.return, modifiers: .command)
            .opacity(0)
        )
    }
}

struct GitBranchesTab: View {
    let projectDir: String

    @Environment(ToastCenter.self) private var toasts
    @State private var branches: [GitBranch] = []
    @State private var loading = false
    @State private var creating = false
    @State private var newName = ""
    @State private var pendingDelete: String?
    @FocusState private var inputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            Group {
                if creating {
                    HStack(spacing: 8) {
                        ThemedTextField(placeholder: "Branch name", text: $newName, height: 30) {
                            create()
                        }
                        .focused($inputFocused)
                        .onExitCommand {
                            creating = false
                            newName = ""
                        }
                        Button("Create") {
                            create()
                        }
                        .buttonStyle(PrimaryButtonStyle(height: 30))
                        .disabled(loading || newName.trimmingCharacters(in: .whitespaces).isEmpty)
                        Button {
                            creating = false
                            newName = ""
                        } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 11))
                        }
                        .buttonStyle(HoverButtonStyle(padding: 8))
                        .disabled(loading)
                    }
                } else {
                    Button {
                        creating = true
                        inputFocused = true
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "plus")
                                .font(.system(size: 10))
                            Text("New Branch")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(OutlineButtonStyle(height: 30))
                    .disabled(loading)
                }
            }
            .padding(12)
            .cardBorder(.bottom)

            ScrollView {
                VStack(spacing: 8) {
                    let local = branches.filter { !$0.isRemote }
                    if local.isEmpty {
                        Text("No branches")
                            .font(.system(size: 13))
                            .foregroundStyle(Palette.mutedForeground)
                            .padding(.vertical, 24)
                    } else {
                        ForEach(local) { branch in
                            HStack(spacing: 8) {
                                Image(systemName: "arrow.triangle.branch")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Palette.mutedForeground)
                                Text(branch.name)
                                    .font(.system(size: 13))
                                    .lineLimit(1)
                                if branch.isCurrent {
                                    BadgeView(text: "current")
                                }
                                Spacer()
                                if !branch.isCurrent {
                                    Button("Switch") {
                                        checkout(branch.name)
                                    }
                                    .buttonStyle(OutlineButtonStyle(height: 28))
                                    .disabled(loading)
                                    Button {
                                        pendingDelete = branch.name
                                    } label: {
                                        Image(systemName: "trash")
                                            .font(.system(size: 12))
                                    }
                                    .buttonStyle(HoverButtonStyle(padding: 7))
                                    .disabled(loading)
                                }
                            }
                            .padding(8)
                            .overlay(RoundedRectangle(cornerRadius: 4).stroke(Palette.border, lineWidth: 1))
                        }
                    }
                }
                .padding(16)
            }
        }
        .task(id: projectDir) {
            await load()
        }
        .confirmationDialog(
            "Delete branch \"\(pendingDelete ?? "")\"?",
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } })
        ) {
            Button("Delete", role: .destructive) {
                if let name = pendingDelete {
                    delete(name)
                }
            }
            Button("Cancel", role: .cancel) {}
        }
    }

    private func load() async {
        loading = true
        do {
            branches = try await GitService.branches(projectDir)
        } catch {
            toasts.error("Failed to load branches")
        }
        loading = false
    }

    private func checkout(_ name: String) {
        Task {
            do {
                try await GitService.checkout(projectDir, name)
                toasts.success("Switched to \(name)")
            } catch {
                toasts.error("Failed to checkout branch")
            }
            await load()
        }
    }

    private func delete(_ name: String) {
        Task {
            do {
                try await GitService.deleteBranch(projectDir, name, force: false)
                toasts.success("Deleted branch: \(name)")
            } catch {
                toasts.error("Failed to delete branch")
            }
            await load()
        }
    }

    private func create() {
        let name = newName.trimmingCharacters(in: .whitespaces)
        if name.isEmpty {
            toasts.error("Branch name is required")
            return
        }
        loading = true
        Task {
            do {
                try await GitService.createBranch(projectDir, name)
                toasts.success("Created branch: \(name)")
                newName = ""
                creating = false
            } catch {
                toasts.error("Failed to create branch")
            }
            await load()
        }
    }
}
