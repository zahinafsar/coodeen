import Foundation

struct ProcessResult {
    let status: Int32
    let stdout: String
    let stderr: String

    var ok: Bool {
        status == 0
    }

    var trimmedOut: String {
        stdout.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

struct ProcessError: LocalizedError {
    let message: String

    var errorDescription: String? {
        message
    }
}

enum ProcessRunner {
    static func run(
        _ executable: String,
        _ arguments: [String],
        cwd: String? = nil,
        env: [String: String]? = nil,
        input: String? = nil
    ) async -> ProcessResult {
        await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                continuation.resume(returning: runSync(executable, arguments, cwd: cwd, env: env, input: input))
            }
        }
    }

    static func runSync(
        _ executable: String,
        _ arguments: [String],
        cwd: String? = nil,
        env: [String: String]? = nil,
        input: String? = nil
    ) -> ProcessResult {
        let process = Process()
        if executable.hasPrefix("/") {
            process.executableURL = URL(fileURLWithPath: executable)
            process.arguments = arguments
        } else {
            process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            process.arguments = [executable] + arguments
        }
        if let cwd {
            process.currentDirectoryURL = URL(fileURLWithPath: cwd)
        }
        process.environment = env ?? ShellEnvironment.environment()

        let outPipe = Pipe()
        let errPipe = Pipe()
        process.standardOutput = outPipe
        process.standardError = errPipe

        let inPipe: Pipe?
        if input != nil {
            let p = Pipe()
            process.standardInput = p
            inPipe = p
        } else {
            process.standardInput = FileHandle.nullDevice
            inPipe = nil
        }

        var outData = Data()
        var errData = Data()
        let group = DispatchGroup()

        do {
            try process.run()
        } catch {
            return ProcessResult(status: -1, stdout: "", stderr: error.localizedDescription)
        }

        group.enter()
        DispatchQueue.global().async {
            outData = outPipe.fileHandleForReading.readDataToEndOfFile()
            group.leave()
        }
        group.enter()
        DispatchQueue.global().async {
            errData = errPipe.fileHandleForReading.readDataToEndOfFile()
            group.leave()
        }

        if let inPipe, let input {
            inPipe.fileHandleForWriting.write(Data(input.utf8))
            try? inPipe.fileHandleForWriting.close()
        }

        process.waitUntilExit()
        group.wait()

        return ProcessResult(
            status: process.terminationStatus,
            stdout: String(data: outData, encoding: .utf8) ?? "",
            stderr: String(data: errData, encoding: .utf8) ?? ""
        )
    }
}
