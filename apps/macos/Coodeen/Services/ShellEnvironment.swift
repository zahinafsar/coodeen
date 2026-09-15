import Foundation

enum ShellEnvironment {
    private static let lock = NSLock()
    private static var cached: [String: String]?

    static var shellPath: String {
        let env = ProcessInfo.processInfo.environment
        if let shell = env["SHELL"], !shell.isEmpty {
            return shell
        }
        return "/bin/zsh"
    }

    static var home: String {
        FileManager.default.homeDirectoryForCurrentUser.path
    }

    static func environment() -> [String: String] {
        lock.lock()
        if let cached {
            lock.unlock()
            return cached
        }
        lock.unlock()

        var env = ProcessInfo.processInfo.environment
        if let path = loginShellPath(), !path.isEmpty {
            env["PATH"] = path
        } else {
            let fallback = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"]
            let existing = (env["PATH"] ?? "").split(separator: ":").map(String.init)
            env["PATH"] = (fallback + existing).uniqued().joined(separator: ":")
        }

        lock.lock()
        cached = env
        lock.unlock()
        return env
    }

    private static func loginShellPath() -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: shellPath)
        process.arguments = ["-ilc", "printf '__COODEEN_PATH__%s__END__' \"$PATH\""]
        let out = Pipe()
        process.standardOutput = out
        process.standardError = Pipe()
        process.standardInput = FileHandle.nullDevice
        do {
            try process.run()
        } catch {
            return nil
        }
        let deadline = Date().addingTimeInterval(5)
        while process.isRunning && Date() < deadline {
            Thread.sleep(forTimeInterval: 0.05)
        }
        if process.isRunning {
            process.terminate()
            return nil
        }
        let data = out.fileHandleForReading.readDataToEndOfFile()
        guard let text = String(data: data, encoding: .utf8) else {
            return nil
        }
        guard
            let start = text.range(of: "__COODEEN_PATH__"),
            let end = text.range(of: "__END__", range: start.upperBound..<text.endIndex)
        else {
            return nil
        }
        return String(text[start.upperBound..<end.lowerBound])
    }
}

extension Array where Element: Hashable {
    func uniqued() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}
