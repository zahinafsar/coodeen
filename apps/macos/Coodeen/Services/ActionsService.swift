import Foundation

enum ActionsService {
    static func loadActions(_ dir: String) -> [ProjectAction] {
        let url = URL(fileURLWithPath: dir).appendingPathComponent("coodeen.json")
        guard let json = JSONFileStore.load(url) else {
            return []
        }
        return (json["actions"]?.arrayValue ?? []).compactMap { item in
            guard let label = item["label"]?.stringValue, let script = item["script"]?.stringValue else {
                return nil
            }
            return ProjectAction(label: label, script: script)
        }
    }

    private static func loadEnv(_ dir: String) -> [String: String] {
        var env = ShellEnvironment.environment()
        let url = URL(fileURLWithPath: dir).appendingPathComponent(".env")
        guard let content = try? String(contentsOf: url, encoding: .utf8) else {
            return env
        }
        for rawLine in content.split(separator: "\n") {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            if line.isEmpty || line.hasPrefix("#") {
                continue
            }
            guard let eq = line.firstIndex(of: "=") else {
                continue
            }
            let key = line[line.startIndex..<eq].trimmingCharacters(in: .whitespaces)
            var value = line[line.index(after: eq)...].trimmingCharacters(in: .whitespaces)
            if value.hasPrefix("\"") || value.hasPrefix("'") {
                value.removeFirst()
            }
            if value.hasSuffix("\"") || value.hasSuffix("'") {
                value.removeLast()
            }
            if !key.isEmpty {
                env[key] = value
            }
        }
        return env
    }

    static func run(_ dir: String, script: String) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/sh")
        process.arguments = ["-c", script]
        process.currentDirectoryURL = URL(fileURLWithPath: dir)
        process.environment = loadEnv(dir)
        process.standardInput = FileHandle.nullDevice
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        try process.run()
    }
}
