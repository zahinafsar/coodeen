import Foundation

enum SidecarError: LocalizedError {
    case timeout(String)
    case exited(String)
    case notReady

    var errorDescription: String? {
        switch self {
        case .timeout(let log):
            return "Timed out waiting for opencode sidecar.\n\(log)"
        case .exited(let log):
            return "opencode sidecar exited early.\n\(log)"
        case .notReady:
            return "opencode sidecar not ready"
        }
    }
}

actor OpencodeSidecar {
    static let shared = OpencodeSidecar()

    private var process: Process?
    private var baseURL: URL?
    private var bootTask: Task<URL, Error>?

    func start() async throws -> URL {
        if let baseURL {
            return baseURL
        }
        if let bootTask {
            return try await bootTask.value
        }
        let task = Task { try await self.boot() }
        bootTask = task
        do {
            let url = try await task.value
            return url
        } catch {
            bootTask = nil
            throw error
        }
    }

    func currentURL() -> URL? {
        baseURL
    }

    func restart() async throws -> URL {
        stop()
        return try await start()
    }

    func stop() {
        if let process, process.isRunning {
            process.terminate()
        }
        process = nil
        baseURL = nil
        bootTask = nil
    }

    nonisolated func stopSync() {
        let semaphore = DispatchSemaphore(value: 0)
        Task {
            await self.stop()
            semaphore.signal()
        }
        _ = semaphore.wait(timeout: .now() + 2)
    }

    private func binaryPath() -> String {
        if let url = Bundle.main.resourceURL?.appendingPathComponent("bin/opencode"),
           FileManager.default.isExecutableFile(atPath: url.path) {
            return url.path
        }
        return "opencode"
    }

    private func boot() async throws -> URL {
        let proc = Process()
        let binary = binaryPath()
        let args = ["serve", "--hostname=127.0.0.1", "--port=0"]
        if binary.hasPrefix("/") {
            proc.executableURL = URL(fileURLWithPath: binary)
            proc.arguments = args
        } else {
            proc.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            proc.arguments = [binary] + args
        }
        proc.environment = ShellEnvironment.environment()
        proc.currentDirectoryURL = FileManager.default.homeDirectoryForCurrentUser
        proc.standardInput = FileHandle.nullDevice

        let outPipe = Pipe()
        let errPipe = Pipe()
        proc.standardOutput = outPipe
        proc.standardError = errPipe

        let reader = SidecarOutputReader()

        outPipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if data.isEmpty {
                handle.readabilityHandler = nil
                return
            }
            reader.appendStdout(data)
        }
        errPipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if data.isEmpty {
                handle.readabilityHandler = nil
                return
            }
            reader.appendStderr(data)
        }
        proc.terminationHandler = { p in
            reader.markExited(code: p.terminationStatus)
        }

        try proc.run()
        process = proc

        let url = try await reader.waitForURL(timeout: 10)
        baseURL = url
        return url
    }
}

final class SidecarOutputReader: @unchecked Sendable {
    private let lock = NSLock()
    private var stdout = ""
    private var stderr = ""
    private var url: URL?
    private var exited: Int32?
    private var continuation: CheckedContinuation<URL, Error>?

    func appendStdout(_ data: Data) {
        lock.lock()
        stdout += String(data: data, encoding: .utf8) ?? ""
        if url == nil, let found = Self.findURL(in: stdout) {
            url = found
        }
        let resolved = url
        let cont = continuation
        if resolved != nil {
            continuation = nil
        }
        lock.unlock()
        if let resolved, let cont {
            cont.resume(returning: resolved)
        }
    }

    func appendStderr(_ data: Data) {
        lock.lock()
        stderr += String(data: data, encoding: .utf8) ?? ""
        if stderr.count > 20000 {
            stderr = String(stderr.suffix(20000))
        }
        lock.unlock()
    }

    func markExited(code: Int32) {
        lock.lock()
        exited = code
        let cont = continuation
        continuation = nil
        let log = "stdout: \(stdout)\nstderr: \(stderr)"
        lock.unlock()
        cont?.resume(throwing: SidecarError.exited("code=\(code)\n\(log)"))
    }

    func waitForURL(timeout: TimeInterval) async throws -> URL {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<URL, Error>) in
            lock.lock()
            if let url {
                lock.unlock()
                cont.resume(returning: url)
                return
            }
            if let exited {
                let log = "stdout: \(stdout)\nstderr: \(stderr)"
                lock.unlock()
                cont.resume(throwing: SidecarError.exited("code=\(exited)\n\(log)"))
                return
            }
            continuation = cont
            lock.unlock()

            DispatchQueue.global().asyncAfter(deadline: .now() + timeout) { [weak self] in
                guard let self else {
                    return
                }
                self.lock.lock()
                let pending = self.continuation
                self.continuation = nil
                let log = "stdout: \(self.stdout)\nstderr: \(self.stderr)"
                self.lock.unlock()
                pending?.resume(throwing: SidecarError.timeout(log))
            }
        }
    }

    private static func findURL(in text: String) -> URL? {
        let pattern = #"opencode server listening\s+on\s+(https?://\S+)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return nil
        }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        guard
            let match = regex.firstMatch(in: text, range: range),
            let r = Range(match.range(at: 1), in: text)
        else {
            return nil
        }
        return URL(string: String(text[r]))
    }
}
