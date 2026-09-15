import Foundation

enum GitService {
    private static func git(_ args: [String], _ dir: String, input: String? = nil) async -> ProcessResult {
        await ProcessRunner.run("git", args, cwd: dir, input: input)
    }

    private static func gitOrThrow(_ args: [String], _ dir: String) async throws -> String {
        let result = await git(args, dir)
        if !result.ok {
            var message = result.stderr
            if message.isEmpty {
                message = result.stdout
            }
            throw ProcessError(message: message.trimmingCharacters(in: .whitespacesAndNewlines))
        }
        return result.trimmedOut
    }

    static func isRepo(_ dir: String) async -> Bool {
        await git(["rev-parse", "--git-dir"], dir).ok
    }

    static func status(_ dir: String) async -> GitStatus {
        if !(await isRepo(dir)) {
            return GitStatus(isGitRepo: false, branch: "", changes: [], ahead: 0, behind: 0)
        }
        let branch = await git(["rev-parse", "--abbrev-ref", "HEAD"], dir).trimmedOut
        let porcelain = await git(["status", "--porcelain"], dir).stdout

        var ahead = await git(["rev-list", "--count", "@{u}..HEAD"], dir)
        if !ahead.ok {
            ahead = await git(["rev-list", "--count", "origin/\(branch)..HEAD"], dir)
        }
        var behind = await git(["rev-list", "--count", "HEAD..@{u}"], dir)
        if !behind.ok {
            behind = await git(["rev-list", "--count", "HEAD..origin/\(branch)"], dir)
        }

        let changes = porcelain
            .split(separator: "\n", omittingEmptySubsequences: true)
            .compactMap { sub -> GitChange? in
                let line = String(sub)
                if line.count < 4 {
                    return nil
                }
                let chars = Array(line)
                var index = String(chars[0])
                if index == " " {
                    index = ""
                }
                var work = String(chars[1])
                if work == " " {
                    work = ""
                }
                let file = String(chars[3...])
                let status = String(chars[0..<2]).trimmingCharacters(in: .whitespaces)
                return GitChange(file: file, index: index, workTree: work, status: status)
            }

        var aheadCount = 0
        if ahead.ok {
            aheadCount = Int(ahead.trimmedOut) ?? 0
        }
        var behindCount = 0
        if behind.ok {
            behindCount = Int(behind.trimmedOut) ?? 0
        }
        return GitStatus(isGitRepo: true, branch: branch, changes: changes, ahead: aheadCount, behind: behindCount)
    }

    static func branches(_ dir: String) async throws -> [GitBranch] {
        let current = await git(["rev-parse", "--abbrev-ref", "HEAD"], dir).trimmedOut
        let list = try await gitOrThrow(["branch", "-a"], dir)
        return list.split(separator: "\n").compactMap { sub in
            let trimmed = sub.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty {
                return nil
            }
            let isRemote = trimmed.hasPrefix("remotes/")
            let isCurrent = trimmed.hasPrefix("*")
            var name = trimmed
            if name.hasPrefix("*") {
                name = String(name.dropFirst()).trimmingCharacters(in: .whitespaces)
            }
            let fullRef = name
            if name.hasPrefix("remotes/") {
                name = String(name.dropFirst("remotes/".count))
            }
            return GitBranch(name: name, isCurrent: isCurrent || name == current, isRemote: isRemote, fullRef: fullRef)
        }
    }

    static func checkout(_ dir: String, _ branch: String) async throws {
        _ = try await gitOrThrow(["checkout", branch], dir)
    }

    static func createBranch(_ dir: String, _ branch: String) async throws {
        _ = try await gitOrThrow(["branch", branch], dir)
    }

    static func deleteBranch(_ dir: String, _ branch: String, force: Bool) async throws {
        var flag = "-d"
        if force {
            flag = "-D"
        }
        _ = try await gitOrThrow(["branch", flag, branch], dir)
    }

    static func stage(_ dir: String, _ files: [String]) async throws {
        _ = try await gitOrThrow(["add", "--"] + files, dir)
    }

    static func unstage(_ dir: String, _ files: [String]) async throws {
        _ = try await gitOrThrow(["reset", "HEAD", "--"] + files, dir)
    }

    static func commit(_ dir: String, _ message: String) async throws {
        let result = await git(["commit", "-F", "-"], dir, input: message.trimmingCharacters(in: .whitespacesAndNewlines))
        if !result.ok {
            var message = result.stderr
            if message.isEmpty {
                message = result.stdout
            }
            if message.isEmpty {
                message = "Commit failed"
            }
            throw ProcessError(message: message)
        }
    }

    static func push(_ dir: String) async throws {
        let result = await git(["push"], dir)
        if !result.ok {
            _ = try await gitOrThrow(["push", "-u", "origin", "HEAD"], dir)
        }
    }

    static func pull(_ dir: String) async throws {
        _ = try await gitOrThrow(["pull"], dir)
    }

    static func discard(_ dir: String, _ files: [String]) async throws {
        let porcelain = await git(["status", "--porcelain"], dir).stdout
        let untracked = Set(
            porcelain.split(separator: "\n")
                .filter { $0.hasPrefix("??") }
                .map { String($0.dropFirst(3)) }
        )
        let tracked = files.filter { !untracked.contains($0) }
        let newFiles = files.filter { untracked.contains($0) }
        if !tracked.isEmpty {
            _ = try await gitOrThrow(["checkout", "--"] + tracked, dir)
        }
        for file in newFiles {
            let url = URL(fileURLWithPath: dir).appendingPathComponent(file)
            try? FileManager.default.removeItem(at: url)
        }
    }
}
