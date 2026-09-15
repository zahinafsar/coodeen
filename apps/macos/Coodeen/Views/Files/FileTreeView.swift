import SwiftUI
import AppKit

struct FileTreeView: View {
    let rootPath: String
    @Binding var selectedFile: String?
    let refreshKey: Int
    let onRefresh: () -> Void

    @Environment(ToastCenter.self) private var toasts
    @State private var cache: [String: [TreeEntry]] = [:]
    @State private var expanded: Set<String> = []
    @State private var loading = false
    @State private var pendingDelete: (path: String, isDir: Bool)?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if loading && cache[rootPath] == nil {
                    Text("Loading...")
                        .font(.system(size: 13))
                        .foregroundStyle(Palette.mutedForeground)
                        .padding(16)
                } else if let entries = cache[rootPath] {
                    if entries.isEmpty {
                        Text("No files found")
                            .font(.system(size: 12))
                            .italic()
                            .foregroundStyle(Palette.mutedForeground.opacity(0.6))
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                    }
                    ForEach(entries) { entry in
                        nodes(entry: entry, parent: rootPath, depth: 0)
                    }
                }
            }
            .padding(.vertical, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .task(id: "\(rootPath)|\(refreshKey)") {
            await reload()
        }
        .confirmationDialog(
            deleteTitle,
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } })
        ) {
            Button("Delete", role: .destructive) {
                if let target = pendingDelete {
                    delete(target.path)
                }
            }
            Button("Cancel", role: .cancel) {}
        }
    }

    private var deleteTitle: String {
        guard let target = pendingDelete else {
            return ""
        }
        let name = (target.path as NSString).lastPathComponent
        if target.isDir {
            return "Delete folder \"\(name)\"?"
        }
        return "Delete file \"\(name)\"?"
    }

    private func nodes(entry: TreeEntry, parent: String, depth: Int) -> AnyView {
        let fullPath = "\(parent)/\(entry.name)"
        let isOpen = expanded.contains(fullPath)
        return AnyView(
            VStack(alignment: .leading, spacing: 0) {
                FileTreeRow(
                    entry: entry,
                    fullPath: fullPath,
                    depth: depth,
                    open: isOpen,
                    selected: selectedFile == fullPath,
                    onClick: {
                        if entry.isDir {
                            toggle(fullPath)
                        } else {
                            selectedFile = fullPath
                        }
                    },
                    onDelete: {
                        pendingDelete = (fullPath, entry.isDir)
                    }
                )
                if entry.isDir && isOpen {
                    if let children = cache[fullPath] {
                        ForEach(children) { child in
                            nodes(entry: child, parent: fullPath, depth: depth + 1)
                        }
                        if children.isEmpty {
                            Text("Empty")
                                .font(.system(size: 12))
                                .italic()
                                .foregroundStyle(Palette.mutedForeground.opacity(0.6))
                                .padding(.leading, CGFloat((depth + 1) * 16 + 4))
                                .padding(.vertical, 2)
                        }
                    }
                }
            }
        )
    }

    private func toggle(_ path: String) {
        if expanded.contains(path) {
            expanded.remove(path)
            return
        }
        expanded.insert(path)
        if cache[path] == nil {
            load(path)
        }
    }

    private func load(_ path: String) {
        if let entries = try? FileService.listTree(path) {
            cache[path] = entries
        }
    }

    private func reload() async {
        loading = true
        var next: [String: [TreeEntry]] = [:]
        if let entries = try? FileService.listTree(rootPath) {
            next[rootPath] = entries
        }
        for path in expanded where path.hasPrefix(rootPath) {
            if let entries = try? FileService.listTree(path) {
                next[path] = entries
            }
        }
        cache = next
        loading = false
    }

    private func delete(_ path: String) {
        let name = (path as NSString).lastPathComponent
        do {
            try FileService.deleteEntry(path)
            toasts.success("Deleted \(name)")
            if let selected = selectedFile, selected == path || selected.hasPrefix(path + "/") {
                selectedFile = nil
            }
            onRefresh()
        } catch {
            toasts.error(error.localizedDescription)
        }
        pendingDelete = nil
    }
}

private struct FileTreeRow: View {
    let entry: TreeEntry
    let fullPath: String
    let depth: Int
    let open: Bool
    let selected: Bool
    let onClick: () -> Void
    let onDelete: () -> Void

    @State private var hovering = false

    var body: some View {
        HStack(spacing: 0) {
            if entry.isDir {
                Image(systemName: open ? "chevron.down" : "chevron.right")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(Palette.mutedForeground)
                    .frame(width: 14)
            } else {
                Color.clear.frame(width: 14)
            }
            Image(systemName: icon)
                .font(.system(size: 11))
                .foregroundStyle(entry.isDir ? Palette.blue : Palette.mutedForeground)
                .frame(width: 16)
                .padding(.trailing, 6)
            Text(entry.name)
                .font(.system(size: 13))
                .lineLimit(1)
                .truncationMode(.middle)
            Spacer(minLength: 4)
            if hovering {
                Button(action: onDelete) {
                    Image(systemName: "trash")
                        .font(.system(size: 10))
                        .frame(width: 16, height: 16)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .foregroundStyle(Palette.mutedForeground)
                .help("Delete \(entry.name)")
            }
        }
        .padding(.leading, CGFloat(depth * 16 + 4))
        .padding(.trailing, 6)
        .padding(.vertical, 2)
        .foregroundStyle(Palette.foreground)
        .background(
            RoundedRectangle(cornerRadius: 3)
                .fill(selected ? Palette.accent : (hovering ? Palette.accent.opacity(0.5) : Color.clear))
        )
        .contentShape(Rectangle())
        .onTapGesture(perform: onClick)
        .onHover { hovering = $0 }
        .help(fullPath)
        .onDrag {
            NSItemProvider(object: URL(fileURLWithPath: fullPath) as NSURL)
        }
    }

    private var icon: String {
        if entry.isDir {
            if open {
                return "folder.fill"
            }
            return "folder"
        }
        let ext = (entry.name as NSString).pathExtension.lowercased()
        if ext == "json" {
            return "curlybraces"
        }
        if ext == "md" || ext == "txt" {
            return "doc.text"
        }
        if FileService.imageExtensions.contains(ext) {
            return "photo"
        }
        let code: Set<String> = [
            "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rs", "go", "java", "c", "cpp", "h",
            "rb", "php", "swift", "kt", "dart", "lua", "sh", "bash", "zsh", "css", "scss", "html",
            "xml", "vue", "svelte",
        ]
        if code.contains(ext) {
            return "chevron.left.forwardslash.chevron.right"
        }
        return "doc"
    }
}
