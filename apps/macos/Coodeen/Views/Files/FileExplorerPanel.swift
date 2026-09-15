import SwiftUI
import AppKit
import UniformTypeIdentifiers

struct FileExplorerPanel: View {
    @Environment(Workspace.self) private var workspace
    @Environment(ToastCenter.self) private var toasts

    @State private var selectedFile: String?
    @State private var refreshKey = 0
    @State private var createType: CreateEntryType?
    @State private var treeFraction: CGFloat = 0.35

    var body: some View {
        if workspace.projectDir.isEmpty {
            Text("Select a project directory to browse files")
                .font(.system(size: 13))
                .foregroundStyle(Palette.mutedForeground)
                .multilineTextAlignment(.center)
                .padding(24)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            VStack(spacing: 0) {
                HStack(spacing: 4) {
                    toolbarButton("doc.badge.plus", help: "New file") {
                        createType = .file
                    }
                    toolbarButton("folder.badge.plus", help: "New folder") {
                        createType = .dir
                    }
                    toolbarButton("square.and.arrow.down", help: "Upload file") {
                        upload()
                    }
                    Spacer()
                    Text((workspace.projectDir as NSString).lastPathComponent)
                        .font(.system(size: 11))
                        .foregroundStyle(Palette.mutedForeground)
                        .lineLimit(1)
                        .frame(maxWidth: 200, alignment: .trailing)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(Palette.card)
                .cardBorder(.bottom)

                SplitView(axis: .horizontal, fraction: $treeFraction, minFirst: 140, minSecond: 200) {
                    FileTreeView(
                        rootPath: workspace.projectDir,
                        selectedFile: $selectedFile,
                        refreshKey: refreshKey,
                        onRefresh: { refreshKey += 1 }
                    )
                    .onDrop(of: [.fileURL], isTargeted: nil) { providers in
                        importDropped(providers)
                    }
                } second: {
                    FileViewer(filePath: selectedFile)
                        .id(selectedFile ?? "")
                }
            }
            .sheet(item: $createType) { type in
                CreateEntrySheet(parentDir: workspace.projectDir, type: type) {
                    refreshKey += 1
                }
            }
        }
    }

    private func toolbarButton(_ icon: String, help: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .frame(width: 16, height: 16)
        }
        .buttonStyle(HoverButtonStyle(padding: 6))
        .help(help)
    }

    private func upload() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        if panel.runModal() == .OK {
            copyFiles(panel.urls)
        }
    }

    private func copyFiles(_ urls: [URL]) {
        for url in urls {
            do {
                let name = try FileService.copyInto(directory: workspace.projectDir, from: url)
                toasts.success("Uploaded \(name)")
            } catch {
                toasts.error("Failed to upload \(url.lastPathComponent)")
            }
        }
        refreshKey += 1
    }

    private func importDropped(_ providers: [NSItemProvider]) -> Bool {
        let root = workspace.projectDir
        var handled = false
        for provider in providers where provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
            handled = true
            _ = provider.loadObject(ofClass: URL.self) { url, _ in
                guard let url else {
                    return
                }
                if url.path.hasPrefix(root + "/") {
                    return
                }
                Task { @MainActor in
                    copyFiles([url])
                }
            }
        }
        return handled
    }
}

enum CreateEntryType: String, Identifiable {
    case file
    case dir

    var id: String {
        rawValue
    }
}

private struct CreateEntrySheet: View {
    let parentDir: String
    let type: CreateEntryType
    let onCreated: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastCenter.self) private var toasts
    @State private var name = ""

    private var title: String {
        if type == .dir {
            return "Create Folder"
        }
        return "Create File"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
            VStack(alignment: .leading, spacing: 6) {
                Text("Name")
                    .font(.system(size: 12))
                ThemedTextField(placeholder: type == .dir ? "folder-name" : "filename.ts", text: $name) {
                    create()
                }
            }
            Text("\(parentDir)/\(name.isEmpty ? "..." : name)")
                .font(.system(size: 11))
                .foregroundStyle(Palette.mutedForeground)
                .lineLimit(1)
                .truncationMode(.head)
            HStack {
                Spacer()
                Button("Cancel") {
                    dismiss()
                }
                .buttonStyle(OutlineButtonStyle(height: 30))
                Button("Create") {
                    create()
                }
                .buttonStyle(PrimaryButtonStyle(height: 30))
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(20)
        .frame(width: 380)
        .background(Palette.card)
        .foregroundStyle(Palette.foreground)
    }

    private func create() {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty {
            return
        }
        do {
            try FileService.createEntry("\(parentDir)/\(trimmed)", isDir: type == .dir)
            if type == .dir {
                toasts.success("Folder created")
            } else {
                toasts.success("File created")
            }
            onCreated()
            dismiss()
        } catch {
            toasts.error(error.localizedDescription)
        }
    }
}
