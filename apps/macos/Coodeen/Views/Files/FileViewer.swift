import SwiftUI
import AppKit

struct FileViewer: View {
    let filePath: String?

    @Environment(Workspace.self) private var workspace
    @Environment(ToastCenter.self) private var toasts

    @State private var code = ""
    @State private var original = ""
    @State private var binarySize: Int?
    @State private var loading = false
    @State private var error: String?
    @State private var saving = false
    @State private var editorController = CodeEditorController()

    var body: some View {
        Group {
            if let filePath {
                content(filePath)
            } else {
                placeholder("Select a file to view")
            }
        }
        .task(id: filePath ?? "") {
            load()
        }
    }

    @ViewBuilder
    private func content(_ path: String) -> some View {
        if loading {
            placeholder("Loading...")
        } else if let error {
            VStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle")
                    .font(.system(size: 28))
                    .foregroundStyle(Palette.amber)
                Text(error)
                    .font(.system(size: 13))
                    .foregroundStyle(Palette.mutedForeground)
                    .multilineTextAlignment(.center)
            }
            .padding()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let binarySize {
            VStack(spacing: 8) {
                Image(systemName: "doc.questionmark")
                    .font(.system(size: 28))
                    .foregroundStyle(Palette.mutedForeground)
                Text("Binary file (\(String(format: "%.1f", Double(binarySize) / 1024)) KB)")
                    .font(.system(size: 13))
                    .foregroundStyle(Palette.mutedForeground)
                Text("Cannot preview binary files")
                    .font(.system(size: 11))
                    .foregroundStyle(Palette.mutedForeground)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            editor(path)
        }
    }

    private func placeholder(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 13))
            .foregroundStyle(Palette.mutedForeground)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func editor(_ path: String) -> some View {
        let language = Self.detectLanguage(path)
        let dirty = code != original

        return VStack(spacing: 0) {
            HStack(spacing: 8) {
                Text((path as NSString).lastPathComponent)
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                Text(language)
                    .font(.system(size: 10))
                    .foregroundStyle(Palette.mutedForeground)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(RoundedRectangle(cornerRadius: 4).fill(Palette.muted))
                if dirty {
                    Text("Modified")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(Palette.amber)
                }
                Spacer()
                Button {
                    reference(path)
                } label: {
                    Image(systemName: "at")
                        .font(.system(size: 12))
                        .frame(width: 14, height: 14)
                }
                .buttonStyle(HoverButtonStyle(padding: 5))
                .help("Reference selected code in prompt")

                Button {
                    save(path)
                } label: {
                    Image(systemName: "square.and.arrow.down")
                        .font(.system(size: 12))
                        .frame(width: 14, height: 14)
                }
                .buttonStyle(HoverButtonStyle(active: dirty, padding: 5))
                .disabled(saving || !dirty)
                .keyboardShortcut("s", modifiers: .command)
                .help("Save (Cmd+S)")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 5)
            .background(Palette.card)
            .cardBorder(.bottom)

            CodeEditorView(text: $code, language: Self.highlightAlias(language), controller: editorController)
        }
    }

    static func detectLanguage(_ path: String) -> String {
        let name = (path as NSString).lastPathComponent.lowercased()
        let ext = (name as NSString).pathExtension
        if name == "dockerfile" || name.hasPrefix("dockerfile.") {
            return "docker"
        }
        if name == ".env" || name.hasPrefix(".env.") {
            return "bash"
        }
        if name == ".gitignore" || name == ".dockerignore" || name == ".editorconfig" {
            return "plaintext"
        }
        let map: [String: String] = [
            "ts": "typescript", "tsx": "tsx", "mts": "typescript", "cts": "typescript",
            "js": "javascript", "jsx": "jsx", "mjs": "javascript", "cjs": "javascript",
            "vue": "markup", "svelte": "markup", "astro": "markup",
            "html": "markup", "htm": "markup", "css": "css", "scss": "scss", "sass": "scss", "less": "less",
            "json": "json", "jsonc": "json", "json5": "json", "yaml": "yaml", "yml": "yaml",
            "toml": "toml", "ini": "ini", "xml": "markup", "svg": "markup",
            "graphql": "graphql", "gql": "graphql", "prisma": "graphql",
            "md": "markdown", "mdx": "markdown", "rmd": "markdown",
            "sh": "bash", "bash": "bash", "zsh": "bash", "fish": "bash",
            "py": "python", "pyi": "python", "pyw": "python",
            "rs": "rust", "go": "go", "java": "java", "kt": "kotlin", "kts": "kotlin",
            "c": "c", "h": "c", "cpp": "cpp", "cc": "cpp", "cxx": "cpp", "hpp": "cpp", "hxx": "cpp",
            "cs": "csharp", "m": "objectivec", "swift": "swift",
            "rb": "ruby", "rake": "ruby", "gemspec": "ruby", "php": "php", "dart": "dart", "lua": "lua",
            "r": "r", "sql": "sql", "pl": "perl", "pm": "perl", "scala": "scala",
            "clj": "clojure", "cljs": "clojure", "cljc": "clojure",
            "ps1": "powershell", "psm1": "powershell", "dockerfile": "docker",
            "tf": "hcl", "hcl": "hcl", "proto": "protobuf",
            "txt": "plaintext", "log": "plaintext", "csv": "plaintext",
        ]
        return map[ext] ?? "plaintext"
    }

    static func highlightAlias(_ language: String) -> String? {
        switch language {
        case "plaintext":
            return nil
        case "tsx":
            return "typescript"
        case "jsx":
            return "javascript"
        case "markup":
            return "xml"
        case "toml":
            return "ini"
        case "docker":
            return "dockerfile"
        case "hcl":
            return nil
        default:
            return language
        }
    }

    private func load() {
        guard let filePath else {
            code = ""
            original = ""
            binarySize = nil
            error = nil
            return
        }
        loading = true
        error = nil
        binarySize = nil
        do {
            switch try FileService.readFile(filePath) {
            case .text(let text, _):
                code = text
                original = text
            case .binary(let size):
                binarySize = size
                code = ""
                original = ""
            }
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    private func save(_ path: String) {
        if code == original {
            return
        }
        saving = true
        do {
            try FileService.writeFile(path, content: code)
            original = code
        } catch {
            toasts.error(error.localizedDescription)
        }
        saving = false
    }

    private func reference(_ path: String) {
        let range = editorController.selectedRange
        if range.location == NSNotFound || range.length == 0 {
            return
        }
        let ns = code as NSString
        if range.location + range.length > ns.length {
            return
        }
        let before = ns.substring(to: range.location)
        let selected = ns.substring(with: range)
        let startLine = before.filter { $0 == "\n" }.count + 1
        let endLine = startLine + selected.filter { $0 == "\n" }.count
        workspace.addFileReference(FileReference(filePath: path, startLine: startLine, endLine: endLine, content: selected))
    }
}
