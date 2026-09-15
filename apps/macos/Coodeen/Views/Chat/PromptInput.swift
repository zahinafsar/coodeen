import SwiftUI
import AppKit
import UniformTypeIdentifiers

struct PromptInput: View {
    enum Variant {
        case standard
        case landing
    }

    let variant: Variant
    let working: Bool

    @Environment(Workspace.self) private var workspace
    @State private var text = ""
    @State private var height: CGFloat = 40
    @State private var dragOver = false
    @State private var controller = PromptTextController()

    private var isLanding: Bool {
        variant == .landing
    }

    private var minHeight: CGFloat {
        if isLanding {
            return 48
        }
        return 40
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !workspace.fileReferences.isEmpty {
                ChipFlow {
                    ForEach(Array(workspace.fileReferences.enumerated()), id: \.element.id) { index, ref in
                        FileReferenceChip(reference: ref) {
                            workspace.fileReferences.remove(at: index)
                        }
                    }
                }
            }

            if !workspace.selections.isEmpty {
                ChipFlow {
                    ForEach(Array(workspace.selections.enumerated()), id: \.element.id) { index, sel in
                        SelectionChip(selection: sel) {
                            workspace.selections.remove(at: index)
                        }
                    }
                }
            }

            if !workspace.screenshots.isEmpty {
                ChipFlow(spacing: 8) {
                    ForEach(workspace.screenshots) { shot in
                        ScreenshotThumb(shot: shot) {
                            workspace.screenshots.removeAll { $0.id == shot.id }
                        }
                    }
                }
            }

            HStack(alignment: .bottom, spacing: 8) {
                PromptTextView(
                    text: $text,
                    height: $height,
                    placeholder: "Describe what you want to build...",
                    fontSize: isLanding ? 15 : 13,
                    disabled: working,
                    controller: controller,
                    minHeight: minHeight,
                    maxHeight: 200,
                    onSubmit: submit,
                    onPasteImage: { image in
                        if let url = ImageUtils.pngDataURL(from: image) {
                            workspace.addScreenshot(url)
                        }
                    }
                )
                .frame(height: max(height, minHeight))
                .padding(.horizontal, 6)
                .background(RoundedRectangle(cornerRadius: Palette.radiusMd).fill(isLanding ? Palette.card : Color.clear))
                .overlay(RoundedRectangle(cornerRadius: Palette.radiusMd).stroke(Palette.border, lineWidth: 1))
                .opacity(working ? 0.6 : 1)

                if working {
                    Button {
                        workspace.stop()
                    } label: {
                        Image(systemName: "stop.fill")
                            .font(.system(size: 13))
                            .frame(width: minHeight, height: minHeight)
                    }
                    .buttonStyle(PrimaryButtonStyle(height: minHeight, destructive: true))
                } else {
                    Button(action: submit) {
                        Image(systemName: "paperplane.fill")
                            .font(.system(size: 13))
                            .frame(width: minHeight - 24, height: minHeight)
                    }
                    .buttonStyle(PrimaryButtonStyle(height: minHeight))
                    .disabled(working)
                }
            }

            HStack(spacing: 8) {
                Button {
                    pickImages()
                } label: {
                    Image(systemName: "photo.badge.plus")
                        .font(.system(size: 11))
                        .frame(width: 16, height: 16)
                }
                .buttonStyle(OutlineButtonStyle(height: 28))
                .help("Upload image")

                Button {
                    pickFolder()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "folder")
                            .font(.system(size: 11))
                        Text(workspace.projectDir.isEmpty ? "Select folder" : workspace.projectDir)
                            .lineLimit(1)
                            .truncationMode(.middle)
                            .frame(maxWidth: 200, alignment: .leading)
                    }
                }
                .buttonStyle(OutlineButtonStyle(height: 28))
                .disabled(!isLanding)
                .help(isLanding ? "Select project folder" : "Project folder is locked once the session has started")

                ModelPicker()
            }
        }
        .padding(isLanding ? 0 : 12)
        .background(isLanding ? Color.clear : Palette.card)
        .cardBorder(isLanding ? [] : .top)
        .overlay {
            if dragOver {
                RoundedRectangle(cornerRadius: Palette.radiusMd)
                    .strokeBorder(Palette.primary, style: StrokeStyle(lineWidth: 2, dash: [6]))
                    .background(Color.black.opacity(0.6))
                    .overlay(
                        Text("Drop images here")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Palette.mutedForeground)
                    )
            }
        }
        .onDrop(of: [.fileURL, .image], isTargeted: $dragOver) { providers in
            handleDrop(providers)
        }
        .onChange(of: workspace.pendingPrefix) { _, prefix in
            if prefix.isEmpty {
                return
            }
            text = prefix + text
            controller.focus()
            workspace.pendingPrefix = ""
        }
    }

    private func submit() {
        let value = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.isEmpty || working {
            return
        }
        text = ""
        controller.clear()

        var finalPrompt = value
        if !workspace.fileReferences.isEmpty {
            let lines = workspace.fileReferences.map { ref in
                if ref.startLine == 0 && ref.endLine == 0 {
                    return "[File: \(ref.filePath)]"
                }
                return "[File: \(ref.filePath):\(ref.startLine)-\(ref.endLine)]"
            }
            finalPrompt = lines.joined(separator: "\n") + "\n\n" + finalPrompt
            workspace.fileReferences = []
        }
        if !workspace.selections.isEmpty {
            let lines = workspace.selections.map { "[Element: \($0.component) in \($0.file):\($0.line)]" }
            finalPrompt = lines.joined(separator: "\n") + "\n" + finalPrompt
            workspace.selections = []
        }
        var images = workspace.screenshots.map(\.dataUrl)
        workspace.screenshots = []

        let urls = Self.extractURLs(value)
        Task {
            var prompt = finalPrompt
            if !urls.isEmpty {
                var fetched: [String] = []
                for url in urls {
                    if let dataUrl = await ImageUtils.fetchImageDataURL(url) {
                        images.append(dataUrl)
                        fetched.append(url)
                    }
                }
                if !fetched.isEmpty {
                    for url in fetched {
                        prompt = prompt.replacingOccurrences(of: url, with: "")
                    }
                    prompt = prompt
                        .replacingOccurrences(of: #"\s{2,}"#, with: " ", options: .regularExpression)
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                }
            }
            await workspace.send(prompt, images: images)
        }
    }

    private static func extractURLs(_ text: String) -> [String] {
        guard let regex = try? NSRegularExpression(pattern: #"https?://\S+"#, options: [.caseInsensitive]) else {
            return []
        }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        let found = regex.matches(in: text, range: range).compactMap { match -> String? in
            guard let r = Range(match.range, in: text) else {
                return nil
            }
            return String(text[r])
        }
        return found.uniqued()
    }

    private func pickImages() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        panel.allowedContentTypes = [.image]
        if panel.runModal() == .OK {
            for url in panel.urls {
                if let dataUrl = ImageUtils.dataURL(fromFile: url) {
                    workspace.addScreenshot(dataUrl)
                }
            }
        }
    }

    private func pickFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.canCreateDirectories = true
        panel.prompt = "Select"
        if !workspace.projectDir.isEmpty {
            panel.directoryURL = URL(fileURLWithPath: workspace.projectDir)
        } else {
            panel.directoryURL = FileManager.default.homeDirectoryForCurrentUser
        }
        if panel.runModal() == .OK, let url = panel.url {
            workspace.projectDir = url.path
        }
    }

    private func handleDrop(_ providers: [NSItemProvider]) -> Bool {
        var handled = false
        for provider in providers {
            if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
                handled = true
                _ = provider.loadObject(ofClass: URL.self) { url, _ in
                    guard let url else {
                        return
                    }
                    Task { @MainActor in
                        if FileService.isImagePath(url.path), let dataUrl = ImageUtils.dataURL(fromFile: url) {
                            workspace.addScreenshot(dataUrl)
                        } else {
                            workspace.addFileReference(FileReference(filePath: url.path, startLine: 0, endLine: 0, content: ""))
                        }
                    }
                }
            } else if provider.canLoadObject(ofClass: NSImage.self) {
                handled = true
                _ = provider.loadObject(ofClass: NSImage.self) { object, _ in
                    guard let image = object as? NSImage else {
                        return
                    }
                    Task { @MainActor in
                        if let dataUrl = ImageUtils.pngDataURL(from: image) {
                            workspace.addScreenshot(dataUrl)
                        }
                    }
                }
            }
        }
        return handled
    }
}

private struct FileReferenceChip: View {
    let reference: FileReference
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "chevron.left.forwardslash.chevron.right")
                .font(.system(size: 9))
            Text((reference.filePath as NSString).lastPathComponent)
                .lineLimit(1)
            if reference.startLine > 0 {
                Text(lineLabel)
                    .foregroundStyle(Palette.blue)
            }
            ChipRemoveButton(action: onRemove)
        }
        .chipStyle()
    }

    private var lineLabel: String {
        if reference.startLine != reference.endLine {
            return "L\(reference.startLine)-L\(reference.endLine)"
        }
        return "L\(reference.startLine)"
    }
}

private struct SelectionChip: View {
    let selection: ElementSelection
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            Text(selection.component)
                .lineLimit(1)
            Text("(\(selection.file):\(selection.line))")
                .foregroundStyle(Palette.blue)
                .lineLimit(1)
            ChipRemoveButton(action: onRemove)
        }
        .chipStyle()
    }
}

private struct ScreenshotThumb: View {
    let shot: ScreenshotAttachment
    let onRemove: () -> Void
    @State private var hovering = false

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Group {
                if let image = ImageUtils.image(fromDataURL: shot.dataUrl) {
                    Image(nsImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } else {
                    Palette.muted
                }
            }
            .frame(width: 80, height: 80)
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: Palette.radiusSm))
            .overlay(RoundedRectangle(cornerRadius: Palette.radiusSm).stroke(Palette.border, lineWidth: 1))

            if hovering {
                Button(action: onRemove) {
                    Image(systemName: "xmark")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 16, height: 16)
                        .background(Circle().fill(Color.black.opacity(0.6)))
                }
                .buttonStyle(.plain)
                .padding(3)
            }
        }
        .onHover { hovering = $0 }
    }
}

private struct ChipRemoveButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark")
                .font(.system(size: 8, weight: .bold))
                .frame(width: 14, height: 14)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(Palette.mutedForeground)
    }
}

private extension View {
    func chipStyle() -> some View {
        self
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(Palette.foreground)
            .padding(.leading, 8)
            .padding(.trailing, 4)
            .padding(.vertical, 3)
            .background(RoundedRectangle(cornerRadius: Palette.radiusSm).fill(Palette.secondary))
    }
}

struct ChipFlow<Content: View>: View {
    var spacing: CGFloat = 6
    @ViewBuilder let content: () -> Content

    var body: some View {
        FlowLayout(spacing: spacing) {
            content()
        }
    }
}

struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var widest: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0 && x + size.width > maxWidth {
                y += rowHeight + spacing
                x = 0
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            widest = max(widest, x - spacing)
        }
        return CGSize(width: min(widest, maxWidth), height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > bounds.minX && x + size.width > bounds.maxX {
                y += rowHeight + spacing
                x = bounds.minX
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
