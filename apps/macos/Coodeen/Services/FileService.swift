import Foundation

enum FileService {
    static let hidden: Set<String> = [
        "node_modules", ".git", ".next", ".cache", ".Trash", "__pycache__",
        ".tox", ".venv", "dist", ".turbo", ".DS_Store",
    ]

    static let binaryExtensions: Set<String> = [
        "png", "jpg", "jpeg", "gif", "bmp", "ico", "webp", "avif",
        "mp3", "mp4", "wav", "avi", "mov", "mkv",
        "zip", "tar", "gz", "rar", "7z",
        "pdf", "doc", "docx", "xls", "xlsx",
        "woff", "woff2", "ttf", "otf", "eot",
        "exe", "dll", "so", "dylib",
        "sqlite", "db",
    ]

    static let imageExtensions: Set<String> = [
        "png", "jpg", "jpeg", "gif", "bmp", "ico", "webp", "avif", "svg", "heic", "tiff",
    ]

    static let maxTextSize = 2 * 1024 * 1024

    static func listTree(_ path: String) throws -> [TreeEntry] {
        let url = URL(fileURLWithPath: path)
        let contents = try FileManager.default.contentsOfDirectory(
            at: url,
            includingPropertiesForKeys: [.isDirectoryKey, .isRegularFileKey],
            options: []
        )
        var result: [TreeEntry] = []
        for item in contents {
            let name = item.lastPathComponent
            if name.hasPrefix(".") && name != ".env" {
                continue
            }
            if hidden.contains(name) {
                continue
            }
            let values = try? item.resourceValues(forKeys: [.isDirectoryKey, .isRegularFileKey])
            if values?.isDirectory == true {
                result.append(TreeEntry(name: name, isDir: true))
            } else if values?.isRegularFile == true {
                result.append(TreeEntry(name: name, isDir: false))
            }
        }
        return result.sorted { a, b in
            if a.isDir != b.isDir {
                return a.isDir
            }
            return a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
        }
    }

    static func readFile(_ path: String) throws -> FileContent {
        let url = URL(fileURLWithPath: path)
        let attrs = try FileManager.default.attributesOfItem(atPath: path)
        let size = (attrs[.size] as? NSNumber)?.intValue ?? 0
        if binaryExtensions.contains(url.pathExtension.lowercased()) {
            return .binary(size: size)
        }
        if size > maxTextSize {
            throw ProcessError(message: "File too large (> 2MB), size: \(size)")
        }
        let data = try Data(contentsOf: url)
        guard let text = String(data: data, encoding: .utf8) else {
            return .binary(size: size)
        }
        return .text(text, language: url.pathExtension.lowercased())
    }

    static func writeFile(_ path: String, content: String) throws {
        let url = URL(fileURLWithPath: path)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try content.write(to: url, atomically: true, encoding: .utf8)
    }

    static func createEntry(_ path: String, isDir: Bool) throws {
        let url = URL(fileURLWithPath: path)
        if isDir {
            try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        } else {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try Data().write(to: url)
        }
    }

    static func deleteEntry(_ path: String) throws {
        try FileManager.default.removeItem(atPath: path)
    }

    static func copyInto(directory: String, from source: URL) throws -> String {
        let target = URL(fileURLWithPath: directory).appendingPathComponent(source.lastPathComponent)
        try FileManager.default.createDirectory(atPath: directory, withIntermediateDirectories: true)
        if FileManager.default.fileExists(atPath: target.path) {
            try FileManager.default.removeItem(at: target)
        }
        try FileManager.default.copyItem(at: source, to: target)
        return target.lastPathComponent
    }

    static func isImagePath(_ path: String) -> Bool {
        imageExtensions.contains(URL(fileURLWithPath: path).pathExtension.lowercased())
    }
}
